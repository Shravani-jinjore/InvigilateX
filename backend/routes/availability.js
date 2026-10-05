// backend/routes/availability.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { authenticate } = require('../middleware/auth');

/** GET /api/availability?faculty_id=xxx */
router.get('/', authenticate, async (req, res) => {
  const { faculty_id } = req.query;
  if (!faculty_id) return res.status(400).json({ error: 'faculty_id required' });

  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('faculty_id', faculty_id)
    .order('date');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * POST /api/availability
 * Upsert a single date's availability for a faculty member.
 * Body: { faculty_id, date, status: 'available'|'unavailable' }
 */
router.post('/', authenticate, async (req, res) => {
  const { faculty_id, date, status } = req.body;
  if (!faculty_id || !date || !status)
    return res.status(400).json({ error: 'faculty_id, date, status required' });
  if (!['available', 'unavailable'].includes(status))
    return res.status(400).json({ error: 'status must be available or unavailable' });

  const { data, error } = await supabase
    .from('availability')
    .upsert({ faculty_id, date, status }, { onConflict: 'faculty_id,date' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * POST /api/availability/bulk
 * Bulk upsert availability for a faculty member.
 * Body: { faculty_id, dates: [{ date, status }] }
 */
router.post('/bulk', authenticate, async (req, res) => {
  const { faculty_id, dates } = req.body;
  if (!faculty_id || !Array.isArray(dates))
    return res.status(400).json({ error: 'faculty_id and dates[] required' });

  const records = dates.map(d => ({ faculty_id, date: d.date, status: d.status }));
  const { data, error } = await supabase
    .from('availability')
    .upsert(records, { onConflict: 'faculty_id,date' })
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** DELETE /api/availability/:id */
router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('availability').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Availability record removed' });
});

module.exports = router;
