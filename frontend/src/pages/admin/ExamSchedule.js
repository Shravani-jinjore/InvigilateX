// frontend/src/pages/admin/ExamSchedule.js
import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import toast from 'react-hot-toast';

const empty = { date: '', session: 'FN', subject_name: '', course_code: '', rooms_required: 1 };

export default function ExamSchedule() {
  const api = useApi();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/exams').then(d => { setExams(d); setLoading(false); });

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) { await api.put(`/exams/${editId}`, form); toast.success('Exam updated'); }
      else { await api.post('/exams', form); toast.success('Exam added'); }
      setShowForm(false); setEditId(null); setForm(empty); load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exam slot? Existing allocations for it will also be removed.')) return;
    try { await api.del(`/exams/${id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  // Group exams by date for better readability
  const grouped = exams.reduce((acc, exam) => {
    if (!acc[exam.date]) acc[exam.date] = [];
    acc[exam.date].push(exam);
    return acc;
  }, {});

  return (
    <div style={{ padding: 32, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Exam Schedule</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>{exams.length} exam slots configured</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(empty); }} style={btnPrimary}>
          + Add Exam
        </button>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#f1f5f9' }}>{editId ? 'Edit Exam' : 'Add Exam Slot'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Date <span style={{ color: '#f87171' }}>*</span></label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Session <span style={{ color: '#f87171' }}>*</span></label>
                  <select value={form.session} onChange={e => setForm(p => ({ ...p, session: e.target.value }))} style={inputStyle}>
                    <option value="FN">FN – Forenoon</option>
                    <option value="AN">AN – Afternoon</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Subject Name <span style={{ color: '#f87171' }}>*</span></label>
                  <input type="text" value={form.subject_name} onChange={e => setForm(p => ({ ...p, subject_name: e.target.value }))} required style={inputStyle} placeholder="Data Structures" />
                </div>
                <div>
                  <label style={labelStyle}>Course Code <span style={{ color: '#f87171' }}>*</span></label>
                  <input type="text" value={form.course_code} onChange={e => setForm(p => ({ ...p, course_code: e.target.value.toUpperCase() }))} required style={inputStyle} placeholder="CS301" />
                </div>
                <div>
                  <label style={labelStyle}>Rooms Required <span style={{ color: '#f87171' }}>*</span></label>
                  <input type="number" min="1" max="20" value={form.rooms_required} onChange={e => setForm(p => ({ ...p, rooms_required: parseInt(e.target.value) }))} required style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>Cancel</button>
                <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : editId ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exam List */}
      {loading ? <p style={{ color: '#64748b' }}>Loading...</p> : Object.keys(grouped).sort().map(date => (
        <div key={date} style={{ marginBottom: 20 }}>
          <div style={{
            background: '#0f172a', borderRadius: '12px 12px 0 0',
            padding: '10px 20px', borderBottom: '1px solid #334155',
            color: '#6366f1', fontWeight: 600, fontSize: 13,
          }}>
            📅 {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
            {grouped[date].map((exam, i) => (
              <div key={exam.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < grouped[date].length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: exam.session === 'FN' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                    color: exam.session === 'FN' ? '#22c55e' : '#f59e0b',
                  }}>{exam.session}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{exam.subject_name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{exam.course_code}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>🏫 {exam.rooms_required} room{exam.rooms_required > 1 ? 's' : ''}</span>
                  <button onClick={() => { setForm(exam); setEditId(exam.id); setShowForm(true); }} style={btnSmall('#6366f1')}>Edit</button>
                  <button onClick={() => handleDelete(exam.id)} style={btnSmall('#ef4444')}>Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {exams.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <p>No exams added yet. Add exam slots or upload a CSV timetable.</p>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 4 };
const inputStyle = { width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const btnPrimary = { padding: '10px 20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnSecondary = { padding: '10px 20px', background: '#334155', border: 'none', borderRadius: 10, color: '#94a3b8', fontSize: 14, cursor: 'pointer' };
const btnSmall = (c) => ({ padding: '5px 12px', background: `${c}22`, border: `1px solid ${c}44`, borderRadius: 6, color: c, fontSize: 12, fontWeight: 600, cursor: 'pointer' });
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalCard = { background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: 32, width: '100%', maxWidth: 560 };
