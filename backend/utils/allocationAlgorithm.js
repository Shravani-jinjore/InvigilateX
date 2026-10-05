// backend/utils/allocationAlgorithm.js
// ============================================================
// GREEDY INVIGILATION DUTY ALLOCATION ALGORITHM
//
// PRIORITY ORDER per exam slot:
//   1. The subject's own faculty (from exams.subject_faculty_name)
//      matched against faculty.name — they MUST be assigned first
//      if they are available and under their duty limit.
//   2. Remaining rooms filled by other faculty sorted by:
//      a. duty_count ASC  (fairness)
//      b. employment_type priority ASC  (type1 > type2 > ... > type6)
//
// CONSTRAINTS:
//   ✗ Faculty already assigned this date+session → skip
//   ✗ Faculty marked unavailable on this date → skip
//   ✗ Faculty duty_count >= max_duty → skip
// ============================================================

const supabase = require('../supabaseClient');

const EMPLOYMENT_PRIORITY = { type1:1, type2:2, type3:3, type4:4, type5:5, type6:6 };

// Normalise a name for fuzzy matching  e.g. "Mr. Vishal Bhojani" → "vishal bhojani"
function normName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function generateInvigilationDuty() {
  // ── Load data ────────────────────────────────────────────
  const [
    { data: exams,    error: e1 },
    { data: faculty,  error: e2 },
    { data: avail,    error: e3 },
  ] = await Promise.all([
    supabase.from('exams').select('*').order('date').order('session'),
    supabase.from('faculty').select('*, subjects(course_code, subject_name)'),
    supabase.from('availability').select('faculty_id, date, status'),
  ]);

  if (e1) throw new Error('Exams: ' + e1.message);
  if (e2) throw new Error('Faculty: ' + e2.message);
  if (e3) throw new Error('Availability: ' + e3.message);
  if (!exams?.length)   throw new Error('No exams found. Upload a timetable first.');
  if (!faculty?.length) throw new Error('No faculty found. Add faculty first.');

  // ── Build availability map ───────────────────────────────
  // { facultyId: { 'YYYY-MM-DD': 'available'|'unavailable' } }
  const availMap = {};
  for (const r of (avail || [])) {
    if (!availMap[r.faculty_id]) availMap[r.faculty_id] = {};
    availMap[r.faculty_id][r.date] = r.status;
  }

  // ── Clear previous allocations & reset counts ────────────
  await supabase.from('allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('faculty').update({ duty_count: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');

  // ── Working state per faculty ────────────────────────────
  const state = faculty.map(f => ({
    ...f,
    duty_count:    0,
    assignedSlots: new Set(),             // "date__session" keys
    normName:      normName(f.name),
    subjectCodes:  new Set((f.subjects || []).map(s => s.course_code.toUpperCase())),
  }));

  // Quick lookup by normalised name
  const byName = {};
  for (const f of state) {
    if (!byName[f.normName]) byName[f.normName] = [];
    byName[f.normName].push(f);
  }

  const allocations   = [];
  const skippedExams  = [];
  let   totalAssigned = 0;

  // ── Group exams by slot ─────────────────────────────────
  const slots = {};
  for (const exam of exams) {
    const key = `${exam.date}__${exam.session}`;
    if (!slots[key]) slots[key] = [];
    slots[key].push({ ...exam, roomsLeft: exam.rooms_required || 1 });
  }

  // ── Process each slot (Date + Session) ───────────────────
  const sortedSlots = Object.keys(slots).sort();
  for (const slotKey of sortedSlots) {
    const slotExams = slots[slotKey];
    const dateStr = slotKey.split('__')[0];

    // ── Phase 1: Assign Subject Faculty (Mandatory Priority) ──
    // Each faculty member can only do ONE duty per slot.
    // We try to match them to their own subject first.
    for (const exam of slotExams) {
      const examCode = exam.course_code.toUpperCase();
      
      // Potential subject faculty for THIS exam
      const subjectFaculty = state.filter(f => {
        if (f.duty_count >= f.max_duty)               return false;
        if (f.assignedSlots.has(slotKey))             return false;
        if (availMap[f.id]?.[dateStr] === 'unavailable') return false;
        // Does this faculty teach this subject? (based on subjects table)
        return f.subjectCodes.has(examCode);
      });

      // Assign them (one per room, up to roomsLeft)
      for (const f of subjectFaculty) {
        if (exam.roomsLeft <= 0) break;
        if (f.assignedSlots.has(slotKey)) continue; // Double check

        allocations.push({ faculty_id: f.id, exam_id: exam.id });
        f.assignedSlots.add(slotKey);
        f.duty_count++;
        totalAssigned++;
        exam.roomsLeft--;
      }
    }

    // ── Phase 2: Fill remaining rooms greedily ──────────────
    for (const exam of slotExams) {
      if (exam.roomsLeft <= 0) continue;

      const eligible = state.filter(f => {
        if (f.duty_count >= f.max_duty)               return false;
        if (f.assignedSlots.has(slotKey))             return false;
        if (availMap[f.id]?.[dateStr] === 'unavailable') return false;
        return true;
      });

      // Sort: Fair rotation (fewest duties) -> Employment priority
      eligible.sort((a, b) => {
        if (a.duty_count !== b.duty_count) return a.duty_count - b.duty_count;
        return (EMPLOYMENT_PRIORITY[a.employment_type] || 9) - (EMPLOYMENT_PRIORITY[b.employment_type] || 9);
      });

      const toAssign = eligible.slice(0, exam.roomsLeft);
      for (const f of toAssign) {
        allocations.push({ faculty_id: f.id, exam_id: exam.id });
        f.assignedSlots.add(slotKey);
        f.duty_count++;
        totalAssigned++;
        exam.roomsLeft--;
      }

      if (exam.roomsLeft > 0) {
        skippedExams.push({
          exam,
          reason: `Only ${exam.rooms_required - exam.roomsLeft}/${exam.rooms_required} rooms staffed`,
        });
      }
    }
  }

  // ── Bulk insert allocations ──────────────────────────────
  if (allocations.length > 0) {
    const { error: ie } = await supabase.from('allocations').insert(allocations);
    if (ie) throw new Error('Insert failed: ' + ie.message);
  }

  // ── Update duty counts in DB ─────────────────────────────
  await Promise.all(
    state.filter(f => f.duty_count > 0).map(f =>
      supabase.from('faculty').update({ duty_count: f.duty_count }).eq('id', f.id)
    )
  );

  return {
    examsProcessed: exams.length,
    totalAssigned,
    skippedExams:   skippedExams.length,
    skippedDetails: skippedExams,
    facultySummary: state.map(f => ({ id: f.id, name: f.name, duty_count: f.duty_count, max_duty: f.max_duty })),
  };
}

module.exports = { generateInvigilationDuty };
