// frontend/src/pages/admin/FacultyManagement.js
import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import toast from 'react-hot-toast';

const TYPES = [
  { value: 'type1', label: 'Type 1 — Professor' },
  { value: 'type2', label: 'Type 2 — Associate Professor' },
  { value: 'type3', label: 'Type 3 — Asst. Professor (Senior Grade)' },
  { value: 'type4', label: 'Type 4 — Assistant Professor' },
  { value: 'type5', label: 'Type 5 — Lecturer' },
  { value: 'type6', label: 'Type 6 — Guest Faculty' },
];

const TYPE_BADGE = {
  type1: '#818cf8', type2: '#6366f1', type3: '#4f46e5',
  type4: '#a78bfa', type5: '#c4b5fd', type6: '#ddd6fe',
};

const EMPTY = {
  name: '', department: '', designation: '',
  employment_type: 'type4', max_duty: 10,
  email: '', phone: '',
  create_login: false, login_email: '', login_password: '',
};

export default function FacultyManagement() {
  const api = useApi();
  const [faculty,   setFaculty]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');
  const [deleting,  setDeleting]  = useState(null);

  const load = async () => {
    try {
      const d = await api.get('/faculty');
      setFaculty(d);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (f) => {
    setForm({ ...EMPTY, ...f, create_login: false, login_email: '', login_password: '' });
    setEditId(f.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/faculty/${editId}`, form);
        toast.success('Faculty updated ✅');
      } else {
        const res = await api.post('/faculty', form);
        toast.success(
          res.login_created
            ? `Faculty added! Login created for ${res.login_email} ✅`
            : 'Faculty added ✅'
        );
      }
      closeForm();
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This will remove all their allocations too.`)) return;
    setDeleting(id);
    try {
      await api.del(`/faculty/${id}`);
      toast.success('Deleted');
      setFaculty(p => p.filter(f => f.id !== id));
    } catch (e) { toast.error(e.message); }
    finally { setDeleting(null); }
  };

  const filtered = faculty.filter(f =>
    !search ||
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.department.toLowerCase().includes(search.toLowerCase()) ||
    f.designation.toLowerCase().includes(search.toLowerCase())
  );

  const fileInputRef = React.useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await api.upload('/faculty-upload', formData);
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ padding: 32, color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Faculty Management</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>{faculty.length} faculty members registered</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.xls,.xlsx"
            style={{ display: 'none' }}
          />
          <button 
            onClick={() => fileInputRef.current.click()} 
            disabled={uploading}
            style={btnSecondary}
          >
            {uploading ? '⏳ Uploading...' : '📤 Upload CSV'}
          </button>
          <button onClick={openAdd} style={btnPrimary}>+ Add Faculty</button>
        </div>
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍  Search by name, department, designation..."
        style={{ ...inputBase, width: 380, marginBottom: 20 }}
      />

      {/* ── MODAL FORM ── */}
      {showForm && (
        <div style={overlay} onClick={e => e.target === e.currentTarget && closeForm()}>
          <div style={modal}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 19, color: '#f1f5f9' }}>
                {editId ? '✏️ Edit Faculty' : '➕ Add Faculty'}
              </h2>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Row 1 */}
              <div style={grid2}>
                <Field label="Full Name *">
                  <input required value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="Dr. Anita Sharma" style={inputBase} />
                </Field>
                <Field label="Department *">
                  <input required value={form.department} onChange={e => set('department', e.target.value)}
                    placeholder="Computer Engineering" style={inputBase} />
                </Field>
              </div>

              {/* Row 2 */}
              <div style={grid2}>
                <Field label="Designation *">
                  <input required value={form.designation} onChange={e => set('designation', e.target.value)}
                    placeholder="Assistant Professor" style={inputBase} />
                </Field>
                <Field label="Employment Type *">
                  <select required value={form.employment_type} onChange={e => set('employment_type', e.target.value)} style={inputBase}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
              </div>

              {/* Row 3 */}
              <div style={grid2}>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="faculty@university.edu" style={inputBase} />
                </Field>
                <Field label="Mobile No.">
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                    placeholder="9876543210" style={inputBase} />
                </Field>
              </div>

              {/* Row 4 */}
              <div style={{ ...grid2, marginBottom: 20 }}>
                <Field label="Max Duty Limit *">
                  <input required type="number" min="1" max="50" value={form.max_duty}
                    onChange={e => set('max_duty', e.target.value)} style={inputBase} />
                </Field>
              </div>

              {/* Login credentials section (add only) */}
              {!editId && (
                <div style={{ background: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid #1e3a5f' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: form.create_login ? 14 : 0 }}>
                    <input
                      type="checkbox"
                      checked={form.create_login}
                      onChange={e => set('create_login', e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>
                      Create login account so this faculty can sign in
                    </span>
                  </label>

                  {form.create_login && (
                    <div style={grid2}>
                      <Field label="Login Email *">
                        <input
                          required={form.create_login}
                          type="email"
                          value={form.login_email}
                          onChange={e => set('login_email', e.target.value)}
                          placeholder="faculty@university.edu"
                          style={inputBase}
                        />
                      </Field>
                      <Field label="Password * (min 6 chars)">
                        <input
                          required={form.create_login}
                          type="password"
                          value={form.login_password}
                          onChange={e => set('login_password', e.target.value)}
                          placeholder="••••••••"
                          style={inputBase}
                          minLength={6}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeForm} style={btnSecondary}>Cancel</button>
                <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
                  {saving ? '⏳ Saving...' : editId ? '✅ Update Faculty' : '✅ Add Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FACULTY TABLE ── */}
      {loading ? (
        <p style={{ color: '#64748b' }}>Loading faculty...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#1e293b', border: '1px solid #334155', borderRadius: 16, color: '#64748b' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <p>{faculty.length === 0 ? 'No faculty yet. Click "+ Add Faculty" to get started.' : 'No results match your search.'}</p>
        </div>
      ) : (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Name', 'Department', 'Designation', 'Type', 'Email', 'Phone', 'Duties', 'Actions'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{f.name}</div>
                    {f.user_id && <div style={{ fontSize: 10, color: '#22c55e', marginTop: 2 }}>● Has login</div>}
                  </td>
                  <td style={td}>{f.department}</td>
                  <td style={td}>{f.designation}</td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                      background: `${TYPE_BADGE[f.employment_type]}22`,
                      color: TYPE_BADGE[f.employment_type],
                    }}>
                      {f.employment_type?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: '#64748b' }}>{f.email || '—'}</td>
                  <td style={{ ...td, fontSize: 12, fontFamily: 'monospace' }}>{f.phone || '—'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 60, height: 6, background: '#0f172a', borderRadius: 3, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${Math.min(100, (f.duty_count / f.max_duty) * 100)}%`,
                          height: '100%', borderRadius: 3,
                          background: f.duty_count >= f.max_duty ? '#ef4444' : '#6366f1',
                        }} />
                      </div>
                      <span style={{ color: f.duty_count >= f.max_duty ? '#f87171' : '#94a3b8', fontSize: 12 }}>
                        {f.duty_count}/{f.max_duty}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(f)} style={btnSm('#6366f1')}>Edit</button>
                    {' '}
                    <button
                      onClick={() => handleDelete(f.id, f.name)}
                      disabled={deleting === f.id}
                      style={btnSm('#ef4444')}
                    >
                      {deleting === f.id ? '...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const inputBase   = { width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const grid2       = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 };
const overlay     = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modal       = { background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: 32, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' };
const btnPrimary  = { padding: '10px 22px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnSecondary= { padding: '10px 22px', background: '#334155', border: 'none', borderRadius: 10, color: '#94a3b8', fontSize: 14, cursor: 'pointer' };
const btnSm       = c => ({ padding: '5px 12px', background: `${c}18`, border: `1px solid ${c}33`, borderRadius: 6, color: c, fontSize: 12, fontWeight: 600, cursor: 'pointer' });
const th          = { color: '#64748b', fontWeight: 500, textAlign: 'left', padding: '12px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
const td          = { padding: '12px 14px', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' };
