// backend/routes/auth.js – Login / Register routes
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

/**
 * POST /api/login
 * Body: { email, password }
 * Returns: { session, user, role }
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  // Fetch role
  const { data: userRecord } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  res.json({
    session: data.session,
    user: data.user,
    role: userRecord?.role || 'faculty',
  });
});

/**
 * POST /api/register  (Admin only – creates faculty accounts)
 * Body: { email, password, role }
 */
router.post('/register', async (req, res) => {
  const { email, password, role = 'faculty' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return res.status(400).json({ error: error.message });

  // Insert into our users table
  await supabase.from('users').insert({ id: data.user.id, email, role });

  res.status(201).json({ user: data.user, role });
});

module.exports = router;
