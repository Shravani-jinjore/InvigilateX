// frontend/src/pages/admin/ReExamModule.js
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const TAB = { UPLOAD: 0, SETTINGS: 1, GENERATE: 2, REPORT: 3 };

const card  = { background:'#1e293b', borderRadius:12, border:'1px solid #334155', padding:24, marginBottom:20 };
const btn   = (bg='#6366f1') => ({ padding:'10px 20px', borderRadius:8, border:'none', background:bg, color:'#fff', cursor:'pointer', fontWeight:600, fontSize:14 });
const input = { background:'#0f172a', border:'1px solid #334155', borderRadius:8, color:'#e2e8f0', padding:'8px 12px', fontSize:14, boxSizing:'border-box' };

export default function ReExamModule() {
  const { get, post, del, upload, download } = useApi();
  const { getToken } = useAuth();

  const [tab, setTab]               = useState(TAB.UPLOAD);
  const [exams, setExams]           = useState([]);
  const [uniqueDates, setUniqueDates] = useState([]);
  const [dailySettings, setDailySettings] = useState({});
  const [uploading, setUploading]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult]   = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportView, setReportView] = useState('matrix');
  const [allocations, setAllocations] = useState([]);

  const loadExams = useCallback(async () => {
    try {
      const data = await get('/reexam/exams');
      setExams(data || []);
      const dates = [...new Set((data || []).map(e => e.date))].sort();
      setUniqueDates(dates);
    } catch { /* silent */ }
  }, [get]);

  const loadSettings = useCallback(async () => {
    try {
      const data = await get('/reexam/daily-settings');
      const map = {};
      (data || []).forEach(s => { map[s.date] = s.num_faculty; });
      setDailySettings(map);
    } catch { /* silent */ }
  }, [get]);

  const loadReport = useCallback(async () => {
    try { const d = await get('/reexam/report'); if (d) setReportData(d); } catch { /* silent */ }
  }, [get]);

  const loadAllocations = useCallback(async () => {
    try { const d = await get('/reexam/allocations'); if (d) setAllocations(d); } catch { /* silent */ }
  }, [get]);

  useEffect(() => { loadExams(); loadSettings(); }, [loadExams, loadSettings]);
  useEffect(() => { if (tab === TAB.REPORT) { loadReport(); loadAllocations(); } }, [tab, loadReport, loadAllocations]);

  // ── Upload ──────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const json = await upload('/reexam/upload', fd);
      toast.success(json.message);
      setUniqueDates(json.uniqueDates || []);
      loadExams();
      setTab(TAB.SETTINGS);
    } catch (err) { toast.error(err.message); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear all re-exam data?')) return;
    try { await del('/reexam/exams'); setExams([]); setUniqueDates([]); setGenResult(null); setReportData(null); toast.success('Cleared'); }
    catch (err) { toast.error(err.message); }
  };

  // ── Settings ────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    const settings = uniqueDates.map(d => ({ date: d, num_faculty: parseInt(dailySettings[d], 10) || 20 }));
    try { await post('/reexam/daily-settings', { settings }); toast.success('Faculty count saved!'); }
    catch (err) { toast.error(err.message); }
  };

  // ── Generate ────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true); setGenResult(null);
    try { const r = await post('/reexam/generate-allocation', {}); setGenResult(r); toast.success('Allocation generated!'); }
    catch (err) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  // ── CSV Download ────────────────────────────────────────────
  const downloadCSV = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/reexam/report?format=csv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error('Export failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'reexam_report.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  const tabs = [
    { label: '📤 Upload CSV',        id: TAB.UPLOAD },
    { label: '👥 Set Faculty Count', id: TAB.SETTINGS },
    { label: '⚙️ Generate',          id: TAB.GENERATE },
    { label: '📊 Report',            id: TAB.REPORT },
  ];

  return (
    <div style={{ padding:32, maxWidth:1300, margin:'0 auto', color:'#e2e8f0', fontFamily:'"DM Sans",system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:26, fontWeight:700, margin:0, color:'#e2e8f0' }}>🔁 Re-Exam Module</h1>
        <p style={{ color:'#64748b', marginTop:6, fontSize:14 }}>
          Upload re-exam timetable · Set faculty count per day · Generate allocation · View report
        </p>
      </div>

      {/* Tab Bar */}
      <div style={{ display:'flex', gap:4, marginBottom:24, background:'#1e293b', borderRadius:10, padding:4, width:'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'9px 18px', border:'none', borderRadius:8,
            background: tab === t.id ? '#6366f1' : 'transparent',
            color: tab === t.id ? '#fff' : '#64748b',
            cursor:'pointer', fontWeight: tab === t.id ? 600 : 400, fontSize:14, transition:'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB 0: Upload ── */}
      {tab === TAB.UPLOAD && (
        <div>
          <div style={card}>
            <h2 style={{ margin:'0 0 8px', fontSize:18, color:'#a5b4fc' }}>Upload Re-Exam CSV / Excel</h2>
            <p style={{ color:'#94a3b8', fontSize:13, marginBottom:20 }}>
              Same format as regular timetable:&nbsp;
              <code style={{ color:'#6ee7b7', background:'#0f172a', padding:'2px 6px', borderRadius:4 }}>
                Code | Course Name | Day and Date | Time | Faculty Name | Mobile No.
              </code>
            </p>

            <label style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              border:'2px dashed #334155', borderRadius:12, padding:48, cursor:'pointer',
              background:'#0f172a', transition:'border-color 0.2s',
            }}>
              <span style={{ fontSize:40, marginBottom:12 }}>📂</span>
              <span style={{ color:'#94a3b8', fontSize:15, fontWeight:500 }}>
                {uploading ? '⏳ Uploading...' : 'Click to choose file'}
              </span>
              <span style={{ color:'#475569', fontSize:12, marginTop:6 }}>CSV, XLS, XLSX supported</span>
              <input type="file" accept=".csv,.xls,.xlsx" onChange={handleUpload} style={{ display:'none' }} disabled={uploading} />
            </label>

            {exams.length > 0 && (
              <div style={{ marginTop:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ color:'#22c55e', fontSize:14 }}>✅ {exams.length} exam slots loaded across {uniqueDates.length} day(s)</span>
                <button onClick={handleClear} style={{ ...btn('rgba(239,68,68,0.1)'), color:'#f87171', border:'1px solid rgba(239,68,68,0.3)' }}>🗑 Clear All</button>
              </div>
            )}
          </div>

          {exams.length > 0 && (
            <div style={card}>
              <h3 style={{ margin:'0 0 14px', color:'#94a3b8', fontSize:15 }}>Preview — {exams.length} rows</h3>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#0f172a' }}>
                      {['Code','Course Name','Date','Time','Subject Faculty','Mobile'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', color:'#64748b', borderBottom:'1px solid #334155' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exams.slice(0,12).map(e => (
                      <tr key={e.id} style={{ borderBottom:'1px solid #1e293b' }}>
                        <td style={{ padding:'9px 12px', color:'#a5b4fc', fontWeight:600 }}>{e.course_code}</td>
                        <td style={{ padding:'9px 12px' }}>{e.subject_name}</td>
                        <td style={{ padding:'9px 12px', color:'#6ee7b7' }}>{e.date}</td>
                        <td style={{ padding:'9px 12px', color:'#94a3b8', fontSize:12 }}>{e.time}</td>
                        <td style={{ padding:'9px 12px' }}>{e.subject_faculty_name || <span style={{ color:'#475569' }}>—</span>}</td>
                        <td style={{ padding:'9px 12px', color:'#64748b' }}>{e.subject_faculty_mobile || '—'}</td>
                      </tr>
                    ))}
                    {exams.length > 12 && (
                      <tr><td colSpan={6} style={{ padding:'8px 12px', color:'#475569', fontSize:12, textAlign:'center' }}>+ {exams.length - 12} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setTab(TAB.SETTINGS)} style={{ ...btn(), marginTop:16 }}>Next: Set Faculty Count →</button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 1: Settings ── */}
      {tab === TAB.SETTINGS && (
        <div style={card}>
          <h2 style={{ margin:'0 0 6px', fontSize:18, color:'#a5b4fc' }}>Set Faculty Count Per Day</h2>
          <p style={{ color:'#64748b', fontSize:13, marginBottom:24 }}>
            Each faculty does exactly <strong style={{ color:'#e2e8f0' }}>one duty per day</strong>. Enter how many faculty you need allocated per date.
          </p>

          {uniqueDates.length === 0 ? (
            <p style={{ color:'#64748b' }}>No dates found — upload a CSV first.</p>
          ) : (
            <>
              <div style={{ display:'grid', gap:12 }}>
                {uniqueDates.map(date => {
                  const count = exams.filter(e => e.date === date).length;
                  return (
                    <div key={date} style={{
                      display:'flex', alignItems:'center', gap:16,
                      background:'#0f172a', borderRadius:10, padding:'16px 20px',
                    }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, color:'#e2e8f0', fontSize:15 }}>{date}</div>
                        <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>{count} subject{count !== 1 ? 's' : ''} scheduled</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ color:'#94a3b8', fontSize:13 }}>Faculty needed:</span>
                        <input
                          type="number" min={1} max={200}
                          value={dailySettings[date] ?? 20}
                          onChange={e => setDailySettings(p => ({ ...p, [date]: e.target.value }))}
                          style={{ ...input, width:80, textAlign:'center' }}
                          placeholder="20"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:20, display:'flex', gap:10 }}>
                <button onClick={handleSaveSettings} style={btn()}>💾 Save Settings</button>
                <button onClick={() => setTab(TAB.GENERATE)} style={{ ...btn('#334155'), color:'#94a3b8' }}>Next: Generate →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: Generate ── */}
      {tab === TAB.GENERATE && (
        <div>
          <div style={card}>
            <h2 style={{ margin:'0 0 8px', fontSize:18, color:'#a5b4fc' }}>Generate Re-Exam Allocation</h2>
            <p style={{ color:'#64748b', fontSize:13, marginBottom:20 }}>
              Runs the greedy algorithm: subject faculty (S*) are prioritised, remaining slots filled by least-busy faculty.
              Faculty availability is respected. Re-exam duties are tracked <em>separately</em> from regular exam duty counts.
            </p>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={handleGenerate} disabled={generating} style={{ ...btn(generating ? '#334155' : '#6366f1'), minWidth:200, opacity: generating ? 0.7 : 1 }}>
                {generating ? '⏳ Generating...' : '⚡ Generate Allocation'}
              </button>
            </div>
          </div>

          {genResult && (
            <div style={card}>
              <h3 style={{ margin:'0 0 16px', color:'#22c55e', fontSize:16 }}>✅ Allocation Complete</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
                {[
                  { label:'Dates Processed', value:genResult.datesProcessed, color:'#a5b4fc' },
                  { label:'Total Assigned',   value:genResult.totalAssigned,   color:'#22c55e' },
                  { label:'Skipped Days',     value:genResult.skipped,         color: genResult.skipped > 0 ? '#f59e0b' : '#22c55e' },
                ].map(s => (
                  <div key={s.label} style={{ background:'#0f172a', borderRadius:10, padding:20, textAlign:'center' }}>
                    <div style={{ fontSize:32, fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ color:'#64748b', fontSize:12, marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {genResult.skippedDetails?.length > 0 && (
                <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:8, padding:14, marginBottom:16 }}>
                  <p style={{ color:'#f59e0b', fontSize:13, margin:'0 0 8px', fontWeight:600 }}>⚠️ Insufficient faculty for some days:</p>
                  {genResult.skippedDetails.map((s, i) => (
                    <div key={i} style={{ color:'#94a3b8', fontSize:13, padding:'3px 0' }}>
                      • {s.date}: {s.reason} {s.assigned !== undefined ? `(assigned ${s.assigned}/${s.requested})` : ''}
                    </div>
                  ))}
                </div>
              )}

              {genResult.facultySummary?.length > 0 && (
                <details style={{ marginBottom:16 }}>
                  <summary style={{ color:'#94a3b8', cursor:'pointer', fontSize:13 }}>View faculty summary ({genResult.facultySummary.length} faculty assigned)</summary>
                  <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:8 }}>
                    {genResult.facultySummary.map(f => (
                      <span key={f.id} style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:6, padding:'4px 10px', fontSize:12, color:'#94a3b8' }}>
                        {f.name} — {f.reexamCount} duty
                      </span>
                    ))}
                  </div>
                </details>
              )}

              <button onClick={() => setTab(TAB.REPORT)} style={btn()}>📊 View Report →</button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Report ── */}
      {tab === TAB.REPORT && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div style={{ display:'flex', gap:8 }}>
              {['matrix','list'].map(v => (
                <button key={v} onClick={() => setReportView(v)} style={{
                  ...btn(reportView === v ? '#6366f1' : 'transparent'),
                  border:`1px solid ${reportView === v ? '#6366f1' : '#334155'}`,
                  color: reportView === v ? '#fff' : '#94a3b8',
                }}>
                  {v === 'matrix' ? '⊞ Matrix View' : '≡ List View'}
                </button>
              ))}
            </div>
            <button onClick={downloadCSV} style={{ ...btn('#0f766e') }}>⬇️ Download CSV</button>
          </div>

          {/* Matrix View */}
          {reportView === 'matrix' && (
            reportData ? (
              <div style={{ ...card, padding:0, overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#0f172a' }}>
                      <th style={{ padding:'12px 14px', textAlign:'left', color:'#64748b', borderBottom:'1px solid #334155', position:'sticky', left:0, background:'#0f172a', zIndex:2, minWidth:36 }}>#</th>
                      <th style={{ padding:'12px 14px', textAlign:'left', color:'#64748b', borderBottom:'1px solid #334155', position:'sticky', left:36, background:'#0f172a', zIndex:2, minWidth:190 }}>Faculty</th>
                      <th style={{ padding:'12px 14px', textAlign:'left', color:'#64748b', borderBottom:'1px solid #334155', minWidth:90 }}>Dept</th>
                      {(reportData.slots || []).map(s => (
                        <th key={`${s.date}-${s.time}`} style={{ padding:'8px 10px', textAlign:'center', color:'#64748b', borderBottom:'1px solid #334155', minWidth:100 }}>
                          <div style={{ color:'#a5b4fc', fontWeight:600, fontSize:11 }}>{s.date}</div>
                          <div style={{ fontSize:10, color:'#475569', marginTop:2 }}>{String(s.time || '').substring(0, 18)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.faculty || []).map((f, i) => {
                      const row = (reportData.slots || []).map(s => reportData.allocMap?.[f.id]?.[`${s.date}||${s.time}`] || '');
                      const hasAny = row.some(Boolean);
                      return (
                        <tr key={f.id} style={{ borderBottom:'1px solid #1e293b', opacity: hasAny ? 1 : 0.45 }}>
                          <td style={{ padding:'10px 14px', color:'#475569', position:'sticky', left:0, background: hasAny ? '#1e293b' : '#182230', zIndex:1 }}>{i+1}</td>
                          <td style={{ padding:'10px 14px', position:'sticky', left:36, background: hasAny ? '#1e293b' : '#182230', zIndex:1 }}>
                            <div style={{ fontWeight: hasAny ? 600 : 400, color: hasAny ? '#e2e8f0' : '#475569' }}>{f.name}</div>
                            <div style={{ fontSize:11, color:'#475569' }}>{f.phone || ''}</div>
                          </td>
                          <td style={{ padding:'10px 14px', color:'#64748b', fontSize:11 }}>{f.department}</td>
                          {row.map((val, ci) => (
                            <td key={ci} style={{ padding:'10px 10px', textAlign:'center' }}>
                              {val === 'S*' && <span style={{ background:'rgba(99,102,241,0.2)', color:'#a5b4fc', padding:'2px 8px', borderRadius:6, fontWeight:700, border:'1px solid rgba(99,102,241,0.4)', fontSize:12 }}>S*</span>}
                              {val === 'S'  && <span style={{ background:'rgba(34,197,94,0.15)', color:'#22c55e', padding:'2px 8px', borderRadius:6, fontWeight:600, border:'1px solid rgba(34,197,94,0.3)', fontSize:12 }}>S</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ padding:'12px 16px', borderTop:'1px solid #334155', color:'#64748b', fontSize:13 }}>
                  <span style={{ color:'#a5b4fc', fontWeight:700 }}>S*</span> = Own subject &nbsp;·&nbsp; <span style={{ color:'#22c55e', fontWeight:700 }}>S</span> = Invigilator assigned
                </div>
              </div>
            ) : (
              <div style={{ ...card, textAlign:'center', color:'#64748b', padding:48 }}>
                No data yet — generate allocation first, then reload.
              </div>
            )
          )}

          {/* List View */}
          {reportView === 'list' && (
            allocations.length === 0 ? (
              <div style={{ ...card, textAlign:'center', color:'#64748b', padding:48 }}>No allocations found. Generate first.</div>
            ) : (
              [...new Set(allocations.map(a => a.exam?.date))].sort().map(date => (
                <div key={date} style={{ ...card, marginBottom:16 }}>
                  <h3 style={{ margin:'0 0 14px', color:'#a5b4fc', fontSize:15 }}>📅 {date}</h3>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#0f172a' }}>
                        {['#','Faculty Name','Dept','Time','Subject','Mobile','Mark'].map(h => (
                          <th key={h} style={{ padding:'9px 12px', textAlign:'left', color:'#64748b', borderBottom:'1px solid #334155' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allocations
                        .filter(a => a.exam?.date === date)
                        .sort((a,b) => (a.faculty?.name || '').localeCompare(b.faculty?.name || ''))
                        .map((a, i) => (
                          <tr key={a.id} style={{ borderBottom:'1px solid #1e293b' }}>
                            <td style={{ padding:'9px 12px', color:'#475569' }}>{i+1}</td>
                            <td style={{ padding:'9px 12px', fontWeight:500 }}>{a.faculty?.name}</td>
                            <td style={{ padding:'9px 12px', color:'#64748b', fontSize:12 }}>{a.faculty?.department}</td>
                            <td style={{ padding:'9px 12px', color:'#94a3b8', fontSize:12 }}>{a.exam?.time}</td>
                            <td style={{ padding:'9px 12px', color:'#94a3b8', fontSize:12 }}>{a.exam?.subject_name}</td>
                            <td style={{ padding:'9px 12px', color:'#64748b', fontSize:12 }}>{a.faculty?.phone || '—'}</td>
                            <td style={{ padding:'9px 12px' }}>
                              {a.is_own_subject
                                ? <span style={{ color:'#a5b4fc', fontWeight:700 }}>S*</span>
                                : <span style={{ color:'#22c55e', fontWeight:600 }}>S</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}
