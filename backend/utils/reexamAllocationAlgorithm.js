// backend/utils/reexamAllocationAlgorithm.js
// ============================================================
// GREEDY RE-EXAM INVIGILATION DUTY ALLOCATION ALGORITHM
//
// Rules:
//   - Admin sets N faculty per day via reexam_daily_settings
//   - Each faculty can have at most ONE duty per day
//   - Phase 1: Subject faculty (course match) assigned first → is_own_subject = true (S*)
//   - Phase 2: Remaining slots filled greedily by duty_count ASC, employment_type
//   - Constraints: unavailable dates respected, no double-booking per day
//   - Re-exam duty count is tracked in-memory only (does NOT affect faculty.duty_count)
// ============================================================
const supabase = require('../supabaseClient');

const EMPLOYMENT_PRIORITY = { type1:1, type2:2, type3:3, type4:4, type5:5, type6:6 };

async function generateReExamDuty() {
  const [
    { data: exams,    error: e1 },
    { data: faculty,  error: e2 },
    { data: avail,    error: e3 },
    { data: settings, error: e4 },
  ] = await Promise.all([
    supabase.from('reexam_exams').select('*').order('date').order('time'),
    supabase.from('faculty').select('*, subjects(course_code)'),
    supabase.from('availability').select('faculty_id, date, status'),
    supabase.from('reexam_daily_settings').select('*'),
  ]);

  if (e1) throw new Error('Re-Exam Exams: ' + e1.message);
  if (e2) throw new Error('Faculty: ' + e2.message);
  if (e3) throw new Error('Availability: ' + e3.message);
  if (e4) throw new Error('Settings: ' + e4.message);
  if (!exams?.length)   throw new Error('No re-exam slots found. Upload a CSV first.');
  if (!faculty?.length) throw new Error('No faculty found.');

  // Build availability map { facultyId: { date: status } }
  const availMap = {};
  for (const r of (avail || [])) {
    if (!availMap[r.faculty_id]) availMap[r.faculty_id] = {};
    availMap[r.faculty_id][r.date] = r.status;
  }

  // Build daily faculty count map { date: N }
  const dailyCount = {};
  for (const s of (settings || [])) {
    dailyCount[s.date] = s.num_faculty;
  }

  // Clear previous re-exam allocations
  await supabase.from('reexam_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Working state — separate re-exam duty counter, does NOT touch faculty.duty_count
  const state = faculty.map(f => ({
    ...f,
    reexamCount:  0,
    assignedDays: new Set(),
    subjectCodes: new Set((f.subjects || []).map(s => s.course_code.toUpperCase())),
  }));

  // Group exams by date
  const byDate = {};
  for (const exam of exams) {
    if (!byDate[exam.date]) byDate[exam.date] = [];
    byDate[exam.date].push(exam);
  }

  const allocations  = [];
  const skipped      = [];
  let   totalAssigned = 0;

  for (const date of Object.keys(byDate).sort()) {
    const dateExams = byDate[date];
    const N = dailyCount[date] !== undefined ? dailyCount[date] : 20;
    if (!N || N <= 0) {
      skipped.push({ date, reason: 'No faculty count set for this day' });
      continue;
    }

    let assignedToday = 0;

    // ── Phase 1: Subject faculty (S*) ──────────────────────
    for (const exam of dateExams) {
      if (assignedToday >= N) break;
      const code = exam.course_code.toUpperCase();

      const subjectFac = state.filter(f =>
        !f.assignedDays.has(date) &&
        availMap[f.id]?.[date] !== 'unavailable' &&
        f.subjectCodes.has(code)
      );

      for (const f of subjectFac) {
        if (assignedToday >= N) break;
        allocations.push({ faculty_id: f.id, exam_id: exam.id, is_own_subject: true });
        f.assignedDays.add(date);
        f.reexamCount++;
        totalAssigned++;
        assignedToday++;
      }
    }

    // ── Phase 2: Greedy fill remaining ─────────────────────
    if (assignedToday < N) {
      const eligible = state
        .filter(f =>
          !f.assignedDays.has(date) &&
          availMap[f.id]?.[date] !== 'unavailable'
        )
        .sort((a, b) =>
          a.reexamCount !== b.reexamCount
            ? a.reexamCount - b.reexamCount
            : (EMPLOYMENT_PRIORITY[a.employment_type] || 9) - (EMPLOYMENT_PRIORITY[b.employment_type] || 9)
        );

      // Distribute across exams (round-robin)
      let examIdx = 0;
      for (const f of eligible) {
        if (assignedToday >= N) break;
        const targetExam = dateExams[examIdx % dateExams.length];
        examIdx++;
        allocations.push({ faculty_id: f.id, exam_id: targetExam.id, is_own_subject: false });
        f.assignedDays.add(date);
        f.reexamCount++;
        totalAssigned++;
        assignedToday++;
      }

      if (assignedToday < N) {
        skipped.push({ date, requested: N, assigned: assignedToday, reason: 'Not enough eligible faculty' });
      }
    }
  }

  // Bulk insert allocations
  if (allocations.length > 0) {
    const { error: ie } = await supabase.from('reexam_allocations').insert(allocations);
    if (ie) throw new Error('Insert failed: ' + ie.message);
  }

  return {
    datesProcessed: Object.keys(byDate).length,
    totalAssigned,
    skipped: skipped.length,
    skippedDetails: skipped,
    facultySummary: state
      .filter(f => f.reexamCount > 0)
      .map(f => ({ id: f.id, name: f.name, reexamCount: f.reexamCount })),
  };
}

module.exports = { generateReExamDuty };
