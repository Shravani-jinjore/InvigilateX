// frontend/src/pages/faculty/SubjectsPage.js
import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

export default function SubjectsPage() {
  const api = useApi();
  const { session } = useAuth();
  const [facultyId, setFacultyId] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({ course_code: '', subject_name: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id) return;
      const { data: fac } = await supabase.from('faculty').select('id').eq('user_id', session.user.id).single();
      if (!fac) { setLoading(false); return; }
      setFacultyId(fac.id);
      const data = await api.get(`/subjects?faculty_id=${fac.id}`);
      setSubjects(data);
      setLoading(false);
    };
    load().catch(e => { toast.error(e.message); setLoading(false); });
  }, [session]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!facultyId) return;
    setSaving(true);
    try {
      const data = await api.post('/subjects', { faculty_id: facultyId, ...form });
      setSubjects(prev => [...prev, data]);
      setForm({ course_code: '', subject_name: '' });
      toast.success('Subject added');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.del(`/subjects/${id}`);
      setSubjects(prev => prev.filter(s => s.id !== id));
      toast.success('Subject removed');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ padding: 32, color: '#e2e8f0', maxWidth: 680 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>My Subjects</h1>
      <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
        Add subjects you teach. The allocation algorithm prioritizes you for exams in these subjects.
      </p>

      {/* Add Form */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ color: '#f1f5f9', margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Add a Subject</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 160px' }}>
            <label style={labelStyle}>Course Code</label>
            <input
              type="text"
              value={form.course_code}
              onChange={e => setForm(p => ({ ...p, course_code: e.target.value.toUpperCase() }))}
              placeholder="CS301"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Subject Name</label>
            <input
              type="text"
              value={form.subject_name}
              onChange={e => setForm(p => ({ ...p, subject_name: e.target.value }))}
              placeholder="Data Structures and Algorithms"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" disabled={saving} style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving ? 'Adding...' : '+ Add'}
            </button>
          </div>
        </form>
      </div>

      {/* Subjects List */}
      {loading ? (
        <p style={{ color: '#64748b' }}>Loading subjects...</p>
      ) : subjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b', background: '#1e293b', borderRadius: 16, border: '1px solid #334155' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <p>No subjects added yet. Add subjects you teach to improve allocation accuracy.</p>
        </div>
      ) : (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', background: '#0f172a', borderBottom: '1px solid #334155' }}>
            <span style={{ color: '#64748b', fontSize: 12, fontWeight: 500, textTransform: 'uppercase' }}>
              {subjects.length} Subject{subjects.length !== 1 ? 's' : ''}
            </span>
          </div>
          {subjects.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: i < subjects.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                  fontFamily: 'monospace',
                }}>
                  {s.course_code}
                </span>
                <span style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 500 }}>{s.subject_name}</span>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                style={{
                  padding: '6px 14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8, color: '#f87171',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div style={{ marginTop: 20, padding: 16, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12 }}>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
          💡 <strong style={{ color: '#a5b4fc' }}>How this helps:</strong> When the algorithm assigns invigilation duties,
          faculty who teach a subject are given priority for that exam, leading to better oversight.
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 4 };
const inputStyle = { width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
