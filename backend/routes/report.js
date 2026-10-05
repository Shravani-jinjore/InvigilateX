// backend/routes/report.js
// ============================================================
// Multi-Format Invigilation Reports:
//   1. Matrix Report (Given format: Sr.No. | Faculty Name | Dept | Mobile | Slot Date/Times... with S* / S)
//   2. Normal Allocation Table (Course Code | Course Name | Day & Date | Time | Faculty | Mobile...)
//   3. Date-wise Report (grouped by Date -> Session -> Exam -> Faculty)
//   4. Faculty-wise Report (grouped by Faculty with assignments)
// ============================================================
const express  = require('express');
const router   = express.Router();
const supabase = require('../supabaseClient');
const { authenticate } = require('../middleware/auth');

// Rebuild "Day and Date" string from YYYY-MM-DD
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  const d = new Date(`${isoDate}T00:00:00`);
  return `${DAYS[d.getDay()]}, ${dd}/${mm}/${yyyy}`;
}

// Rebuild time string from session
function sessionToTime(session) {
  return session === 'FN' ? '10.30 AM to 12.30 PM' : '03.00 PM to 05.00 PM';
}

// Fuzzy name normalisation
function normName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper to build the Matrix Report data (matching re-exam module and given format)
 */
async function getMatrixData() {
  const [
    { data: allFaculty, error: fe },
    { data: allExams, error: ee },
    { data: allocations, error: ae },
    { data: subjects, error: se },
  ] = await Promise.all([
    supabase
      .from('faculty')
      .select('id, name, department, phone, employment_type, designation')
      .order('name'),
    supabase
      .from('exams')
      .select('*')
      .order('date')
      .order('session'),
    supabase
      .from('allocations')
      .select(`
        id,
        faculty:faculty_id (id, name, department, phone, employment_type, designation),
        exam:exam_id (id, date, session, subject_name, course_code, subject_faculty_name)
      `),
    supabase
      .from('subjects')
      .select('faculty_id, course_code'),
  ]);

  if (fe) throw fe;
  if (ee) throw ee;
  if (ae) throw ae;

  // Build subject lookup set: "faculty_id__COURSECODE"
  const subSet = new Set((subjects || []).map(s => `${s.faculty_id}__${(s.course_code || '').toUpperCase()}`));

  // Build unique slots sorted chronologically (FN before AN on each day)
  const slotsMap = new Map();
  const sortedExams = (allExams || []).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const sessionOrder = { FN: 0, AN: 1 };
    return (sessionOrder[a.session] ?? 0) - (sessionOrder[b.session] ?? 0);
  });

  for (const exam of sortedExams) {
    const time = sessionToTime(exam.session);
    const key = `${exam.date}||${time}`;
    if (!slotsMap.has(key)) {
      slotsMap.set(key, {
        date: exam.date,
        session: exam.session,
        time,
      });
    }
  }
  const slots = Array.from(slotsMap.values());

  // Build allocation map: { facultyId: { slotKey: 'S*' | 'S' } }
  const allocMap = {};
  for (const a of (allocations || [])) {
    const fid = a.faculty?.id;
    if (!fid || !a.exam) continue;

    const time = sessionToTime(a.exam.session);
    const key = `${a.exam.date}||${time}`;

    const isOwn =
      subSet.has(`${fid}__${(a.exam.course_code || '').toUpperCase()}`) ||
      (a.exam.subject_faculty_name && a.faculty?.name &&
        (normName(a.exam.subject_faculty_name).includes(normName(a.faculty.name)) ||
         normName(a.faculty.name).includes(normName(a.exam.subject_faculty_name))));

    if (!allocMap[fid]) allocMap[fid] = {};
    if (isOwn) {
      allocMap[fid][key] = 'S*';
    } else if (!allocMap[fid][key]) {
      allocMap[fid][key] = 'S';
    }
  }

  return { slots, faculty: allFaculty || [], allocMap };
}

function matrixToCsv(slots, faculty, allocMap) {
  const headers = [
    'Sr.No.',
    'Faculty Name',
    'Department',
    'Mobile No.',
    ...slots.map(s => `${s.date} | ${s.time}`),
  ];

  const rows = faculty.map((f, i) => {
    const cells = slots.map(s => allocMap[f.id]?.[`${s.date}||${s.time}`] || '');
    return [i + 1, f.name, f.department, f.phone || '', ...cells];
  });

  return [headers, ...rows]
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

/**
 * GET /api/report/matrix
 * Returns matrix grid data for normal exams (faculty x exam slots with S* / S).
 * ?format=csv → downloads matrix CSV in the given format
 */
router.get('/matrix', authenticate, async (req, res) => {
  try {
    const { slots, faculty, allocMap } = await getMatrixData();

    if (req.query.format === 'csv') {
      const csv = matrixToCsv(slots, faculty, allocMap);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="invigilation_matrix_report.csv"');
      return res.send(csv);
    }

    res.json({ slots, faculty, allocMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/report?format=json|csv&type=matrix|allocations&faculty_id=xxx
 * Returns normal allocation table (or matrix if requested).
 */
router.get('/', authenticate, async (req, res) => {
  const { format = 'json', type, faculty_id } = req.query;

  // If CSV export is requested for matrix or default
  if (format === 'csv' && type !== 'allocations' && type !== 'flat') {
    try {
      const { slots, faculty, allocMap } = await getMatrixData();
      const csv = matrixToCsv(slots, faculty, allocMap);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="invigilation_matrix_report.csv"');
      return res.send(csv);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  let query = supabase
    .from('allocations')
    .select(`
      faculty:faculty_id (name, department, designation, employment_type, duty_count, email, phone),
      exam:exam_id (date, session, subject_name, course_code, rooms_required, subject_faculty_name, subject_faculty_mobile)
    `);

  if (faculty_id) query = query.eq('faculty_id', faculty_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Flatten into output format
  const flat = data
    .filter(r => r.faculty && r.exam)
    .map(r => ({
      'Course Code':   r.exam.course_code,
      'Course Name':   r.exam.subject_name,
      'Day and Date':  formatDate(r.exam.date),
      'Time':          sessionToTime(r.exam.session),
      'Faculty Name':  r.faculty.name,
      'Mobile No.':    r.faculty.phone || '',
      // Extra fields (visible in JSON, included in CSV)
      'Department':    r.faculty.department,
      'Designation':   r.faculty.designation,
      'Employment Type': r.faculty.employment_type,
      'Subject Faculty': r.exam.subject_faculty_name || '',
      'Is Subject Faculty': r.faculty.name === r.exam.subject_faculty_name ? 'YES' : '',
    }));

  // Sort by date → session → course code
  flat.sort((a, b) => {
    const da = a['Day and Date'], db = b['Day and Date'];
    if (da !== db) return da.localeCompare(db);
    const ta = a['Time'], tb = b['Time'];
    if (ta !== tb) return ta.localeCompare(tb);
    return a['Course Code'].localeCompare(b['Course Code']);
  });

  if (format === 'csv') {
    const cols = [
      'Course Code', 'Course Name', 'Day and Date', 'Time',
      'Faculty Name', 'Mobile No.', 'Department', 'Designation',
      'Employment Type', 'Subject Faculty', 'Is Subject Faculty',
    ];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      cols.join(','),
      ...flat.map(r => cols.map(c => escape(r[c])).join(','))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="invigilation_allocation_table_${Date.now()}.csv"`);
    return res.send(csv);
  }

  res.json({ total: flat.length, data: flat });
});

/**
 * GET /api/report/summary — per-faculty duty count
 */
router.get('/summary', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('faculty')
    .select('id, name, department, designation, employment_type, duty_count, max_duty, phone')
    .order('duty_count', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * GET /api/report/date-wise
 * Returns allocations grouped by date → session → exam,
 * each exam listing all assigned faculties and their allocation type.
 * ?format=csv → downloads date-wise CSV file
 */
router.get('/date-wise', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('allocations')
    .select(`
      faculty:faculty_id (id, name, department, designation, employment_type, phone),
      exam:exam_id (date, session, subject_name, course_code, subject_faculty_name)
    `);
  if (error) return res.status(500).json({ error: error.message });

  // Build a nested map: date → session → courseCode → { examMeta, faculties[] }
  const dateMap = {};
  for (const r of data) {
    if (!r.faculty || !r.exam) continue;
    const { date, session, subject_name, course_code, subject_faculty_name } = r.exam;
    const dateLabel = formatDate(date);
    const rawDate   = date;

    if (!dateMap[rawDate]) dateMap[rawDate] = { label: dateLabel, rawDate, sessions: {} };
    if (!dateMap[rawDate].sessions[session]) dateMap[rawDate].sessions[session] = {};

    const key = course_code || subject_name;
    if (!dateMap[rawDate].sessions[session][key]) {
      dateMap[rawDate].sessions[session][key] = {
        courseCode: course_code,
        courseName: subject_name,
        time: sessionToTime(session),
        faculties: [],
      };
    }
    const allocType = r.faculty.name.trim() === (subject_faculty_name || '').trim()
      ? 'Subject Faculty' : 'Other Faculty';
    const facList = dateMap[rawDate].sessions[session][key].faculties;
    const facKey  = (r.faculty.name || '').trim().toLowerCase();
    // Skip if this faculty (by normalised name) is already listed for this exam
    if (!facList.some(f => (f.name || '').trim().toLowerCase() === facKey)) {
      facList.push({
        name:           r.faculty.name.trim(),
        department:     r.faculty.department,
        designation:    r.faculty.designation,
        employmentType: r.faculty.employment_type,
        phone:          r.faculty.phone || '',
        allocationType: allocType,
      });
    }
  }

  // Convert to sorted array
  const result = Object.values(dateMap)
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    .map(d => ({
      date:     d.label,
      rawDate:  d.rawDate,
      sessions: ['FN', 'AN']
        .filter(s => d.sessions[s])
        .map(s => ({
          session: s,
          time:    sessionToTime(s),
          exams:   Object.values(d.sessions[s]),
        })),
    }));

  if (req.query.format === 'csv') {
    const headers = [
      'Date', 'Session', 'Time', 'Course Code', 'Course Name',
      'Faculty Name', 'Department', 'Designation', 'Phone', 'Allocation Type'
    ];
    const rows = [];
    result.forEach(d => {
      d.sessions.forEach(sess => {
        sess.exams.forEach(ex => {
          ex.faculties.forEach(fac => {
            rows.push([
              d.date,
              sess.session,
              sess.time,
              ex.courseCode,
              ex.courseName,
              fac.name,
              fac.department,
              fac.designation,
              fac.phone || '',
              fac.allocationType,
            ]);
          });
        });
      });
    });

    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invigilation_date_wise.csv"');
    return res.send(csv);
  }

  res.json(result);
});

/**
 * GET /api/report/faculty-wise
 * Returns allocations grouped by faculty,
 * each faculty listing all dates + exams they're assigned to.
 * ?format=csv → downloads combined faculty-wise CSV file
 */
router.get('/faculty-wise', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('allocations')
    .select(`
      faculty:faculty_id (id, name, department, designation, employment_type, phone),
      exam:exam_id (date, session, subject_name, course_code, subject_faculty_name)
    `);
  if (error) return res.status(500).json({ error: error.message });

  // Group by normalised name so duplicate DB records are merged into one card
  const facultyMap = {};
  for (const r of data) {
    if (!r.faculty || !r.exam) continue;
    // Normalise: trim + lowercase → merge duplicates with same name
    const key = (r.faculty.name || '').trim().toLowerCase();
    if (!facultyMap[key]) {
      facultyMap[key] = {
        name:           r.faculty.name.trim(),
        department:     r.faculty.department,
        designation:    r.faculty.designation,
        employmentType: r.faculty.employment_type,
        phone:          r.faculty.phone || '',
        assignments:    [],
      };
    }
    const allocType = r.faculty.name.trim() === (r.exam.subject_faculty_name || '').trim()
      ? 'Subject Faculty' : 'Other Faculty';

    // Avoid adding the exact same duty twice (same date+session+course)
    const dupKey = `${r.exam.date}|${r.exam.session}|${r.exam.course_code}`;
    const alreadyAdded = facultyMap[key].assignments.some(
      a => `${a.rawDate}|${a.session}|${a.courseCode}` === dupKey
    );
    if (!alreadyAdded) {
      facultyMap[key].assignments.push({
        date:           formatDate(r.exam.date),
        rawDate:        r.exam.date,
        session:        r.exam.session,
        time:           sessionToTime(r.exam.session),
        courseCode:     r.exam.course_code,
        courseName:     r.exam.subject_name,
        allocationType: allocType,
      });
    }
  }

  // Sort each faculty's assignments by date → session
  const result = Object.values(facultyMap)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(f => ({
      ...f,
      assignments: f.assignments.sort((a, b) =>
        a.rawDate !== b.rawDate
          ? a.rawDate.localeCompare(b.rawDate)
          : a.session.localeCompare(b.session)
      ),
    }));

  if (req.query.format === 'csv') {
    const headers = [
      'Faculty Name', 'Department', 'Designation', 'Employment Type', 'Phone',
      'Date', 'Session', 'Time', 'Course Code', 'Course Name', 'Allocation Type'
    ];
    const rows = [];
    result.forEach(f => {
      f.assignments.forEach(a => {
        rows.push([
          f.name,
          f.department,
          f.designation,
          f.employmentType,
          f.phone || '',
          a.date,
          a.session,
          a.time,
          a.courseCode,
          a.courseName,
          a.allocationType,
        ]);
      });
    });

    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invigilation_faculty_wise_all.csv"');
    return res.send(csv);
  }

  res.json(result);
});

module.exports = router;

