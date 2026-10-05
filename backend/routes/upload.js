// backend/routes/upload.js
// ============================================================
// Parses the institution timetable CSV/Excel.
//
// INPUT FORMAT (your actual file):
//   Sr. No. | Code | Course Name | Day and Date | Time |
//   Student Count | Faculty Name | Mobile No. | Count (+10) | COUNT
//
// KEY LOGIC:
//   - "Faculty Name" in the CSV = the subject teacher for that exam
//     → stored in exams.subject_faculty_name + exams.subject_faculty_mobile
//   - rooms_required = ceil(COUNT / 36)  [36 students per room]
//   - session: AM start → FN, PM start → AN
//   - date: "Thursday, 07/05/2026" → "2026-05-07"
// ============================================================
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const Papa     = require('papaparse');
const XLSX     = require('xlsx');
const supabase = require('../supabaseClient');
const { authenticate, requireAdmin } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    ['csv','xls','xlsx'].includes(ext) ? cb(null, true) : cb(new Error('CSV/Excel only'));
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

// "10.30 AM to 12.30 PM" → FN,  "03.00 PM ..." → AN
function parseSession(t) {
  if (!t) return 'FN';
  const u = String(t).toUpperCase().trim();
  const m = u.match(/^(\d+)[.:]\d+\s*(AM|PM)/);
  return m ? (m[2] === 'AM' ? 'FN' : 'AN') : 'FN';
}

// ceil(n / 36), min 1
function calcRooms(n) {
  const v = parseInt(n, 10);
  return isNaN(v) || v <= 0 ? 1 : Math.max(1, Math.ceil(v / 36));
}

// Flexible column getter (case-insensitive, trimmed)
function get(row, ...keys) {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.trim().toLowerCase() === k.toLowerCase()) {
        const v = row[rk];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
    }
  }
  return null;
}

function normaliseRow(row) {
  const date    = parseDate(get(row, 'Day and Date', 'date', 'Date'));
  const time    = get(row, 'Time', 'time');
  const code    = get(row, 'Code', 'code', 'course_code', 'Course Code');
  const name    = get(row, 'Course Name', 'course name', 'subject_name', 'Subject Name', 'subject');
  const count   = get(row, 'COUNT', 'count', 'Student Count', 'student count', 'students');
  const facName = get(row, 'Faculty Name', 'faculty name', 'faculty');
  const facMob  = get(row, 'Mobile No.', 'Mobile No', 'mobile no', 'mobile', 'Mobile');
  const facDept = get(row, 'Department', 'Dept', 'dept', 'department');
  const session = parseSession(time);

  if (!date || !code || !name) return null;

  return {
    date,
    session,
    subject_name:           name,
    course_code:            code.toUpperCase(),
    rooms_required:         calcRooms(count),
    subject_faculty_name:   facName || null,
    subject_faculty_mobile: facMob  || null,
    department:             facDept || 'General',
  };
}

router.post('/', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
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

  const normalized = rawRows.map(normaliseRow).filter(Boolean);
  if (normalized.length === 0)
    return res.status(400).json({ error: 'No valid rows found. Check column headers.' });

  // ── 1. Aggregate and Deduplicate by course_code ───────────
  // We sum the 'count' (students) for multiple rows of same code
  const aggregated = new Map();
  
  for (const row of rawRows) {
    const code = get(row, 'Code', 'code', 'course_code', 'Course Code');
    if (!code) continue;
    
    const codeUpper = code.toUpperCase().trim();
    const count = parseInt(get(row, 'COUNT', 'count', 'Student Count', 'student count', 'students'), 10) || 0;
    
    if (aggregated.has(codeUpper)) {
      const existing = aggregated.get(codeUpper);
      existing.totalCount += count;
      // Keep first non-null faculty if current is null
      if (!existing.subject_faculty_name) {
        existing.subject_faculty_name = get(row, 'Faculty Name', 'faculty name', 'faculty');
        existing.subject_faculty_mobile = get(row, 'Mobile No.', 'Mobile No', 'mobile no', 'mobile', 'Mobile');
      }
    } else {
      const norm = normaliseRow(row);
      if (norm) {
        aggregated.set(codeUpper, {
          ...norm,
          totalCount: count,
          department: get(row, 'Department', 'Dept', 'dept', 'department') || 'General'
        });
      }
    }
  }

  const uniqueExams = Array.from(aggregated.values()).map(ex => ({
    date:                   ex.date,
    session:                ex.session,
    subject_name:           ex.subject_name,
    course_code:            ex.course_code,
    rooms_required:         calcRooms(ex.totalCount),
    subject_faculty_name:   ex.subject_faculty_name,
    subject_faculty_mobile: ex.subject_faculty_mobile,
    department:             ex.department,
  }));

  try {
    // ── 2. Clear old allocations, exams, and subjects (START FRESH) ───
    await supabase.from('allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('subjects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Optional: Clear dummy faculty (only those without a linked user_id)
    // await supabase.from('faculty').delete().is('user_id', null);

    // ── 3. Handle Faculty & Subjects ────────────────────────
    const { data: existingFaculty } = await supabase.from('faculty').select('id, name, department, phone');
    const facultyMap = new Map(existingFaculty?.map(f => [f.name.toLowerCase().trim(), f]));

    for (const exam of uniqueExams) {
      if (!exam.subject_faculty_name) continue;

      // Split names by / or , or ;
      const names = exam.subject_faculty_name.split(/[/\,;]/).map(n => n.trim()).filter(Boolean);
      const deptFromCsv = exam.department || 'General';

      for (const name of names) {
        const nameLower = name.toLowerCase();
        let faculty = facultyMap.get(nameLower);

        // Create faculty if they don't exist
        if (!faculty) {
          const { data: newFac, error: facErr } = await supabase
            .from('faculty')
            .insert({
              name:            name,
              department:      deptFromCsv,
              designation:     'Faculty',
              employment_type: 'type4', 
              max_duty:        10,
              email:           '',
              phone:           exam.subject_faculty_mobile
            })
            .select()
            .single();

          if (facErr) {
            console.error(`Failed to create faculty ${name}:`, facErr.message);
            continue;
          }

          if (newFac) {
            faculty = newFac;
            facultyMap.set(nameLower, faculty);
          }
        } else {
          // UPDATE existing faculty if department is "General" or phone is missing
          const needsUpdate = (faculty.department === 'General' && deptFromCsv !== 'General') || (!faculty.phone && exam.subject_faculty_mobile);
          
          if (needsUpdate) {
            const updateData = {};
            if (faculty.department === 'General' && deptFromCsv !== 'General') updateData.department = deptFromCsv;
            if (!faculty.phone && exam.subject_faculty_mobile) updateData.phone = exam.subject_faculty_mobile;

            await supabase.from('faculty').update(updateData).eq('id', faculty.id);
            // Update local map
            Object.assign(faculty, updateData);
          }
        }

        // Link subject to faculty
        if (faculty?.id) {
          await supabase.from('subjects').upsert({
            faculty_id:   faculty.id,
            course_code:  exam.course_code,
            subject_name: exam.subject_name
          }, { onConflict: 'faculty_id,course_code' });
        }
      }
    }

    // ── 4. Insert deduplicated exams ────────────────────────
    // Remove extra fields (like department) before inserting into 'exams' table
    const examsToInsert = uniqueExams.map(({ department, ...rest }) => rest);
    const { data, error } = await supabase.from('exams').insert(examsToInsert).select();
    if (error) throw error;

    res.json({
      message:      `Imported ${data.length} unique exams and synced faculty database`,
      imported:     data.length,
      total_parsed: rawRows.length,
      aggregated:   rawRows.length - uniqueExams.length,
    });

  } catch (err) {
    console.error('Import Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
