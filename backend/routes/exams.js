// backend/routes/exams.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { authenticate, requireAdmin } = require('../middleware/auth');

/** GET /api/exams */
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('date')
    .order('session');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** POST /api/exams – Admin: Add a single exam */
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { date, session, subject_name, course_code, rooms_required, subject_faculty_name, subject_faculty_mobile } = req.body;
  if (!date || !session || !subject_name || !course_code)
    return res.status(400).json({ error: 'date, session, subject_name, course_code required' });
  if (!['FN', 'AN'].includes(session))
    return res.status(400).json({ error: 'session must be FN or AN' });

  const { data, error } = await supabase
    .from('exams')
    .insert({ 
      date, 
      session, 
      subject_name, 
      course_code: course_code.toUpperCase(), 
      rooms_required: rooms_required || 1,
      subject_faculty_name,
      subject_faculty_mobile
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/** PUT /api/exams/:id */
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { date, session, subject_name, course_code, rooms_required, subject_faculty_name, subject_faculty_mobile } = req.body;
  const { data, error } = await supabase
    .from('exams')
    .update({ 
      date, 
      session, 
      subject_name, 
      course_code: course_code?.toUpperCase(), 
      rooms_required,
      subject_faculty_name,
      subject_faculty_mobile
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** DELETE /api/exams/:id */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('exams').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Exam deleted' });
});

module.exports = router;
