// frontend/src/pages/admin/AllocationsView.js
import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import toast from 'react-hot-toast';

const TYPE_COLORS = { type1: '#818cf8', type2: '#6366f1', type3: '#4f46e5', type4: '#a78bfa', type5: '#c4b5fd', type6: '#ddd6fe' };

export default function AllocationsView() {
  const api = useApi();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterSession, setFilterSession] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [genResult, setGenResult] = useState(null);

  const load = () => {
    api.get('/allocations')
      .then(d => { setAllocations(d); setLoading(false); })
      .catch(e => { toast.error(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    if (!window.confirm('This will clear all existing allocations and regenerate. Continue?')) return;
    setGenerating(true);
    try {
      const res = await api.post('/generate-allocation', {});
      setGenResult(res);
      toast.success(`✅ ${res.totalAssigned} duties assigned across ${res.examsProcessed} exams`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const filtered = allocations.filter(a => {
    if (filterDate && a.exam?.date !== filterDate) return false;
    if (filterSession && a.exam?.session !== filterSession) return false;
    if (filterDept && !a.faculty?.department?.toLowerCase().includes(filterDept.toLowerCase())) return false;
    return true;
  });

  const uniqueDates = [...new Set(allocations.map(a => a.exam?.date).filter(Boolean))].sort();

  return (
    <div style={{ padding: 32, color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Invigilation Allocations</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>{allocations.length} total assignments</p>
        </div>
        <button onClick={handleGenerate} disabled={generating} style={{
          padding: '11px 24px',
          background: generating ? '#4338ca' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', borderRadius: 12, color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
        }}>
          {generating ? '⚙️ Running Algorithm...' : '⚡ Re-Generate Allocations'}
        </button>
      </div>

      {/* Generation Result Banner */}
      {genResult && (
        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Exams Processed', value: genResult.examsProcessed },
              { label: 'Duties Assigned', value: genResult.totalAssigned },
              { label: 'Skipped Exams', value: genResult.skippedExams },
            ].map(s => (
              <div key={s.label}>
                <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ color: '#a5b4fc', fontSize: 22, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>
          {genResult.skippedDetails?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ color: '#f59e0b', fontSize: 12, margin: '0 0 6px', fontWeight: 600 }}>⚠️ Partially staffed exams:</p>
              {genResult.skippedDetails.slice(0, 5).map((s, i) => (
                <div key={i} style={{ color: '#94a3b8', fontSize: 12 }}>
                  {s.exam?.date} {s.exam?.session} – {s.exam?.subject_name}: {s.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={filterDate} onChange={e => setFilterDate(e.target.value)} style={selectStyle}>
          <option value="">All Dates</option>
          {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterSession} onChange={e => setFilterSession(e.target.value)} style={selectStyle}>
          <option value="">All Sessions</option>
          <option value="FN">Forenoon (FN)</option>
          <option value="AN">Afternoon (AN)</option>
        </select>
        <input
          placeholder="Filter by department..."
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          style={{ ...selectStyle, width: 220 }}
        />
        {(filterDate || filterSession || filterDept) && (
          <button onClick={() => { setFilterDate(''); setFilterSession(''); setFilterDept(''); }}
            style={{ padding: '8px 14px', background: '#334155', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
            Clear Filters
          </button>
        )}
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 13, alignSelf: 'center' }}>
          Showing {filtered.length} of {allocations.length}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#64748b' }}>Loading allocations...</p>
      ) : (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Faculty', 'Department', 'Type', 'Date', 'Session', 'Subject', 'Code', 'Rooms'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{a.faculty?.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{a.faculty?.designation}</div>
                  </td>
                  <td style={tdStyle}>{a.faculty?.department}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                      background: `${TYPE_COLORS[a.faculty?.employment_type] || '#6366f1'}22`,
                      color: TYPE_COLORS[a.faculty?.employment_type] || '#6366f1',
                    }}>
                      {a.faculty?.employment_type?.toUpperCase()}
                    </span>
                  </td>
                  <td style={tdStyle}>{a.exam?.date}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                      background: a.exam?.session === 'FN' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      color: a.exam?.session === 'FN' ? '#22c55e' : '#f59e0b',
                    }}>{a.exam?.session}</span>
                  </td>
                  <td style={tdStyle}>{a.exam?.subject_name}</td>
                  <td style={{ ...tdStyle, color: '#818cf8', fontFamily: 'monospace' }}>{a.exam?.course_code}</td>
                  <td style={tdStyle}>{a.exam?.rooms_required}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚙️</div>
              <p>{allocations.length === 0 ? 'No allocations yet. Click "Generate Allocations" to run the algorithm.' : 'No results match your filters.'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle = { color: '#64748b', fontWeight: 500, textAlign: 'left', padding: '12px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '11px 14px', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' };
const selectStyle = { padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none' };
