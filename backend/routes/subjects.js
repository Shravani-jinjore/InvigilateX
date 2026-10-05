// backend/routes/subjects.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { authenticate } = require('../middleware/auth');

/** GET /api/subjects?faculty_id=xxx */
router.get('/', authenticate, async (req, res) => {
  const { faculty_id } = req.query;
  let query = supabase.from('subjects').select('*');
  if (faculty_id) query = query.eq('faculty_id', faculty_id);
  const { data, error } = await query.order('subject_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** POST /api/subjects */
router.post('/', authenticate, async (req, res) => {
  const { faculty_id, course_code, subject_name } = req.body;
  if (!faculty_id || !course_code || !subject_name)
    return res.status(400).json({ error: 'faculty_id, course_code, subject_name required' });

  const { data, error } = await supabase
    .from('subjects')
    .insert({ faculty_id, course_code: course_code.toUpperCase(), subject_name })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/** DELETE /api/subjects/:id */
router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('subjects').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Subject removed' });
});

module.exports = router;
