// backend/routes/faculty.js
const express  = require('express');
const router   = express.Router();
const supabase = require('../supabaseClient');
const { authenticate, requireAdmin } = require('../middleware/auth');

/** GET /api/faculty — list all with subjects */
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('faculty')
    .select('*, subjects(id, course_code, subject_name)')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** GET /api/faculty/:id */
router.get('/:id', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('faculty')
    .select('*, subjects(id, course_code, subject_name), availability(id, date, status)')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Faculty not found' });
  res.json(data);
});

/**
 * POST /api/faculty
 * Admin: Add a faculty member.
 * Optionally creates a Supabase auth login for them.
 *
 * Body: {
 *   name, department, designation, employment_type, max_duty,
 *   email, phone,
 *   // optional login:
 *   create_login: true,
 *   login_email: 'faculty@univ.edu',
 *   login_password: 'password123'
 * }
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const {
    name, department, designation, employment_type,
    max_duty, email, phone,
    create_login, login_email, login_password,
  } = req.body;

  if (!name || !department || !designation || !employment_type || !max_duty) {
    return res.status(400).json({ error: 'name, department, designation, employment_type, max_duty are required' });
  }

  const validTypes = ['type1','type2','type3','type4','type5','type6'];
  if (!validTypes.includes(employment_type)) {
    return res.status(400).json({ error: `employment_type must be one of: ${validTypes.join(', ')}` });
  }

  let userId = null;

  // ── Optionally create an auth user for this faculty ──────
  if (create_login && login_email && login_password) {
    if (login_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if auth user already exists
    const { data: { users: existing } } = await supabase.auth.admin.listUsers();
    const alreadyExists = existing?.find(u => u.email === login_email);

    if (alreadyExists) {
      return res.status(400).json({ error: `A user with email ${login_email} already exists` });
    }

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email:          login_email,
      password:       login_password,
      email_confirm:  true,
    });

    if (authErr) {
      return res.status(400).json({ error: `Failed to create login: ${authErr.message}` });
    }

    userId = authData.user.id;

    // Insert into public.users
    const { error: userErr } = await supabase
      .from('users')
      .insert({ id: userId, email: login_email, role: 'faculty' });

    if (userErr) {
      // Rollback: delete the auth user we just created
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: `Failed to register user role: ${userErr.message}` });
    }
  }

  // ── Insert faculty record ────────────────────────────────
  const { data, error } = await supabase
    .from('faculty')
    .insert({
      name,
      department,
      designation,
      employment_type,
      max_duty:  parseInt(max_duty, 10),
      duty_count: 0,
      email:     email  || null,
      phone:     phone  || null,
      user_id:   userId || null,
    })
    .select()
    .single();

  if (error) {
    // Rollback auth user if faculty insert fails
    if (userId) await supabase.auth.admin.deleteUser(userId);
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({
    ...data,
    login_created: !!userId,
    login_email:   userId ? login_email : null,
  });
});

/** PUT /api/faculty/:id — update faculty record */
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, department, designation, employment_type, max_duty, email, phone } = req.body;

  if (!name || !department || !designation || !employment_type || !max_duty) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const { data, error } = await supabase
    .from('faculty')
    .update({ name, department, designation, employment_type, max_duty: parseInt(max_duty, 10), email, phone })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** DELETE /api/faculty/:id */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  // Get the user_id so we can also delete the auth account
  const { data: fac } = await supabase
    .from('faculty')
    .select('user_id')
    .eq('id', req.params.id)
    .single();

  const { error } = await supabase.from('faculty').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  // Also delete the linked auth user if one exists
  if (fac?.user_id) {
    await supabase.auth.admin.deleteUser(fac.user_id).catch(() => {});
  }

  res.json({ message: 'Faculty deleted successfully' });
});

module.exports = router;
