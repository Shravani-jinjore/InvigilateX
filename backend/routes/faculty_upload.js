// backend/routes/faculty_upload.js
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const Papa     = require('papaparse');
const XLSX     = require('xlsx');
const supabase = require('../supabaseClient');
const { authenticate, requireAdmin } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Helper for case-insensitive column mapping
function get(row, ...keys) {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.trim().toLowerCase() === k.toLowerCase()) {
        const v = row[rk];
        return v !== undefined && v !== null ? String(v).trim() : null;
      }
    }
  }
  return null;
}

function normalizeFaculty(row) {
  const name        = get(row, 'Name', 'Full Name', 'Faculty Name', 'faculty_name');
  const dept        = get(row, 'Department', 'Dept', 'department');
  const desig       = get(row, 'Designation', 'desig', 'designation');
  const type        = get(row, 'Employment Type', 'type', 'employment_type', 'EmploymentType');
  const email       = get(row, 'Email', 'email_id', 'email');
  const phone       = get(row, 'Phone', 'Mobile', 'Mobile No', 'phone');
  const maxDuty     = get(row, 'Max Duty', 'max_duty', 'limit', 'Duty Limit');

  if (!name) return null;

  // Validate type
  const validTypes = ['type1','type2','type3','type4','type5','type6'];
  let normType = (type || 'type4').toLowerCase().replace(/\s+/g, '');
  if (!validTypes.includes(normType)) normType = 'type4';

  return {
    name,
    department:      dept  || 'General',
    designation:     desig || 'Faculty',
    employment_type: normType,
    email:           email || null,
    phone:           phone || null,
    max_duty:        parseInt(maxDuty, 10) || 10,
    duty_count:      0
  };
}

router.post('/', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = req.file.originalname.split('.').pop().toLowerCase();
  let rawRows = [];

  try {
    if (ext === 'csv') {
      const result = Papa.parse(req.file.buffer.toString('utf-8'), { header: true, skipEmptyLines: true });
      rawRows = result.data;
    } else {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    }
  } catch (e) {
    return res.status(400).json({ error: `Parse failed: ${e.message}` });
  }

  const valid = rawRows.map(normalizeFaculty).filter(Boolean);
  if (valid.length === 0)
    return res.status(400).json({ error: 'No valid faculty records found' });

  try {
    // ── 1. Clear ALL faculty (START FRESH) ──────────────────
    // This will cascade delete subjects, availability, and allocations for these faculty
    await supabase.from('faculty').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // ── 2. Fetch existing users to re-link user_id by email ──
    const { data: users } = await supabase.from('users').select('id, email');
    const emailToUser = new Map(users?.map(u => [u.email.toLowerCase(), u.id]) || []);

    // ── 3. Prepare data for insertion ────────────────────────
    const toInsert = valid.map(f => ({
      ...f,
      user_id: f.email ? emailToUser.get(f.email.toLowerCase()) || null : null
    }));

    if (toInsert.length > 0) {
      const { data, error } = await supabase.from('faculty').insert(toInsert).select();
      if (error) throw error;
      return res.json({
        message: `Successfully imported ${data.length} faculty members. Previous data cleared.`,
        imported: data.length,
        skipped: valid.length - toInsert.length
      });
    } else {
      return res.json({ message: 'No valid faculty members to import', imported: 0, skipped: valid.length });
    }

  } catch (err) {
    console.error('Faculty Import Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
