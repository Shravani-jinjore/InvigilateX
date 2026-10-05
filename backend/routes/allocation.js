// backend/routes/allocation.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generateInvigilationDuty } = require('../utils/allocationAlgorithm');

/**
 * POST /api/generate-allocation
 * Admin: Triggers the allocation algorithm.
 * Clears existing allocations and regenerates from scratch.
 */
router.post('/generate-allocation', authenticate, requireAdmin, async (req, res) => {
  try {
    const summary = await generateInvigilationDuty();
    res.json({ message: 'Allocation generated successfully', ...summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/allocations
 * Returns all allocations with full faculty + exam details.
 * Optional query: ?faculty_id=xxx (for faculty's own view)
 */
router.get('/allocations', authenticate, async (req, res) => {
  const { faculty_id } = req.query;

  let query = supabase
    .from('allocations')
    .select(`
      id,
      assigned_at,
      faculty:faculty_id (id, name, department, designation, employment_type, duty_count),
      exam:exam_id (id, date, session, subject_name, course_code, rooms_required)
    `)
    .order('assigned_at', { ascending: false });

  if (faculty_id) {
    query = query.eq('faculty_id', faculty_id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
