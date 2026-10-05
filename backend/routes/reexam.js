// backend/routes/reexam.js
// ============================================================
// Re-Exam Module Routes — completely isolated from regular exams
// All routes under /api/reexam
// ============================================================
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const Papa     = require('papaparse');
const XLSX     = require('xlsx');
const supabase = require('../supabaseClient');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generateReExamDuty } = require('../utils/reexamAllocationAlgorithm');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    ['csv', 'xls', 'xlsx'].includes(ext) ? cb(null, true) : cb(new Error('CSV/Excel only'));
  },
});

// Handles "Thursday, 07/05/2026", "07/05/2026", Date objects, and ISO date strings
function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(raw).trim();
  if (str.includes('-') && !isNaN(Date.parse(str))) {
    const dObj = new Date(str);
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3];
  return `${year}-${month}-${day}`;
}

// Flexible column getter — exact match first, then partial/contains match
function get(row, ...keys) {
  const rowKeys = Object.keys(row);

  // 1. Try exact case-insensitive match
  for (const k of keys) {
    for (const rk of rowKeys) {
      if (rk.trim().toLowerCase() === k.toLowerCase()) {
        const v = row[rk];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
    }
  }

  // 2. Try partial/contains match (e.g. "Day and Date" matches "Day & Date")
  for (const k of keys) {
    const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const rk of rowKeys) {
      const rkl = rk.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (rkl.includes(kl) || kl.includes(rkl)) {
        const v = row[rk];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
    }
  }
  return null;
}

// ── POST /api/reexam/upload ─────────────────────────────────
router.post('/upload', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = req.file.originalname.split('.').pop().toLowerCase();
  let rawRows = [];

  try {
    if (ext === 'csv') {
      const result = Papa.parse(req.file.buffer.toString('utf-8'), { header: true, skipEmptyLines: true });
      rawRows = result.data;
    } else {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    }
  } catch (e) {
    return res.status(400).json({ error: `Parse failed: ${e.message}` });
  }

  const aggregated = new Map();

  // Log column headers for debugging
  if (rawRows.length > 0) {
    console.log('[ReExam Upload] CSV columns detected:', Object.keys(rawRows[0]));
  }

  for (const row of rawRows) {
    const date = parseDate(get(row,
      'Day and Date', 'Day & Date', 'day and date', 'day & date',
      'Date', 'date', 'Exam Date', 'exam date'
    ));
    const time = get(row,
      'Time', 'time', 'Timing', 'timing', 'Time Slot', 'time slot',
      'Exam Time', 'exam time', 'Session', 'session'
    ) || '';
    const code = get(row,
      'Code', 'code', 'Course Code', 'course code',
      'Subject Code', 'subject code', 'course_code'
    );
    const name = get(row,
      'Course Name', 'course name', 'Subject Name', 'subject name',
      'Subject', 'subject', 'subject_name', 'Name', 'name'
    );
    const facName = get(row,
      'Faculty Name', 'faculty name', 'Faculty', 'faculty',
      'Teacher', 'teacher', 'Instructor', 'instructor'
    );
    const facMob = get(row,
      'Mobile No.', 'Mobile No', 'mobile no', 'mobile',
      'Mobile', 'Phone', 'phone', 'Contact', 'contact'
    );

    if (!date || !code || !name) continue;   // time is optional

    const codeUpper = code.toUpperCase().trim();
    if (!aggregated.has(codeUpper)) {
      aggregated.set(codeUpper, {
        date,
        time,
        course_code:            codeUpper,
        subject_name:           name,
        subject_faculty_name:   facName || null,
        subject_faculty_mobile: facMob  || null,
      });
    }
  }
  const parsed = Array.from(aggregated.values());

  if (parsed.length === 0) {
    const detectedCols = rawRows.length > 0 ? Object.keys(rawRows[0]).join(', ') : 'none';
    console.error('[ReExam Upload] No valid rows. Detected columns:', detectedCols);
    return res.status(400).json({
      error: `No valid rows found. Detected columns: [${detectedCols}]. Required: Code (or "Course Code"), Course Name (or "Subject Name"), Day and Date (or "Date").`,
    });
  }

  try {
    // Clear previous re-exam data on new upload
    await supabase.from('reexam_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reexam_exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { data, error } = await supabase.from('reexam_exams').insert(parsed).select();
    if (error) throw error;

    // Return unique dates so frontend can show faculty-count inputs
    const uniqueDates = [...new Set(data.map(r => r.date))].sort();
    res.json({ message: `Imported ${data.length} re-exam slots`, imported: data.length, uniqueDates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reexam/exams ───────────────────────────────────
router.get('/exams', authenticate, async (req, res) => {
  const { data, error } = await supabase.from('reexam_exams').select('*').order('date').order('time');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── DELETE /api/reexam/exams ────────────────────────────────
router.delete('/exams', authenticate, requireAdmin, async (req, res) => {
  await supabase.from('reexam_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('reexam_exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  res.json({ message: 'Re-exam data cleared' });
});

// ── GET /api/reexam/daily-settings ─────────────────────────
router.get('/daily-settings', authenticate, async (req, res) => {
  const { data, error } = await supabase.from('reexam_daily_settings').select('*').order('date');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── POST /api/reexam/daily-settings ────────────────────────
router.post('/daily-settings', authenticate, requireAdmin, async (req, res) => {
  const { settings } = req.body; // [{ date, num_faculty }]
  if (!settings || !Array.isArray(settings) || settings.length === 0)
    return res.status(400).json({ error: 'settings array required' });

  try {
    const upserts = settings.map(s => ({ date: s.date, num_faculty: parseInt(s.num_faculty, 10) || 20 }));
    const { error } = await supabase
      .from('reexam_daily_settings')
      .upsert(upserts, { onConflict: 'date' });
    if (error) throw error;
    res.json({ message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reexam/generate-allocation ───────────────────
router.post('/generate-allocation', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await generateReExamDuty();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reexam/allocations ────────────────────────────
router.get('/allocations', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('reexam_allocations')
    .select(`
      id, is_own_subject, assigned_at,
      faculty:faculty_id (id, name, department, phone, employment_type, designation),
      exam:exam_id (id, date, time, subject_name, course_code, subject_faculty_name)
    `)
    .order('assigned_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── GET /api/reexam/report ──────────────────────────────────
// Returns matrix data for the grid report
// ?format=csv → downloads CSV file
router.get('/report', authenticate, async (req, res) => {
  const { data: allocations, error: ae } = await supabase
    .from('reexam_allocations')
    .select(`
      is_own_subject,
      faculty:faculty_id (id, name, department, phone, employment_type, designation),
      exam:exam_id (id, date, time, subject_name, course_code)
    `);
  if (ae) return res.status(500).json({ error: ae.message });

  const { data: allFaculty } = await supabase
    .from('faculty')
    .select('id, name, department, phone, employment_type, designation')
    .order('name');

  const { data: allExams } = await supabase
    .from('reexam_exams')
    .select('*')
    .order('date')
    .order('time');

  // Build unique slots (date + time combos)
  const slotsMap = new Map();
  for (const exam of (allExams || [])) {
    const key = `${exam.date}||${exam.time}`;
    if (!slotsMap.has(key)) slotsMap.set(key, exam);
  }
  const slots = Array.from(slotsMap.values());

  // Build allocation map: { facultyId: { slotKey: 'S' | 'S*' } }
  const allocMap = {};
  for (const a of (allocations || [])) {
    const fid = a.faculty?.id;
    const key = `${a.exam?.date}||${a.exam?.time}`;
    if (!fid || !a.exam) continue;
    if (!allocMap[fid]) allocMap[fid] = {};
    allocMap[fid][key] = a.is_own_subject ? 'S*' : 'S';
  }

  if (req.query.format === 'csv') {
    // Format dates nicely for headers: "Thu 07/11 10:30 AM..."
    const headers = ['Sr.No.', 'Faculty Name', 'Department', 'Mobile No.',
      ...slots.map(s => `${s.date} | ${s.time}`)
    ];
    const rows = (allFaculty || []).map((f, i) => {
      const cells = slots.map(s => allocMap[f.id]?.[`${s.date}||${s.time}`] || '');
      // Only include faculty with at least one duty
      return [i + 1, f.name, f.department, f.phone || '', ...cells];
    });

    const csv = [headers, ...rows].map(r =>
      r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="reexam_report.csv"');
    return res.send(csv);
  }

  // JSON response
  res.json({ slots, faculty: allFaculty || [], allocMap });
});

module.exports = router;
