// backend/middleware/auth.js
// Verifies Supabase JWT and attaches user + role to req
const supabase = require('../supabaseClient');

/**
 * Middleware: Verify that request contains a valid Supabase JWT.
 * Attaches req.user and req.userRole.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the JWT via Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch the user's role from our custom users table
    const { data: userRecord, error: userErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userErr || !userRecord) {
      return res.status(401).json({ error: 'User record not found' });
    }

    req.user = user;
    req.userRole = userRecord.role;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Middleware: Require admin role.
 * Must be used AFTER authenticate().
 */
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Middleware: Require faculty role.
 */
const requireFaculty = (req, res, next) => {
  if (req.userRole !== 'faculty') {
    return res.status(403).json({ error: 'Faculty access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireFaculty };
