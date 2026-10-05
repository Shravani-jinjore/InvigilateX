// frontend/src/pages/admin/ReportPage.js
import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import toast from 'react-hot-toast';

const COLS = [
  { key: 'Course Code',        w: 100 },
  { key: 'Course Name',        w: 260 },
  { key: 'Day and Date',       w: 180 },
  { key: 'Time',               w: 180 },
  { key: 'Faculty Name',       w: 180 },
  { key: 'Mobile No.',         w: 120 },
  { key: 'Department',         w: 160 },
  { key: 'Is Subject Faculty', w: 80  },
];

const td = {
  padding: '10px 14px',
  color: '#cbd5e1',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'middle',
};

const badge = (text, color, bg) => (
  <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color }}>
    {text}
  </span>
);

const sessionBadge = (session) =>
  session === 'FN'
    ? badge('FN · 10:30 AM', '#22c55e', 'rgba(34,197,94,0.15)')
    : badge('AN · 3:00 PM', '#f59e0b', 'rgba(245,158,11,0.15)');

const allocBadge = (type) =>
  type === 'Subject Faculty'
    ? badge('⭐ Subject', '#fbbf24', 'rgba(245,158,11,0.15)')
    : badge('Other', '#94a3b8', 'rgba(148,163,184,0.1)');

// ── CSV client-side helpers ──────────────────────────────────
function escapeCsv(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export a single faculty's assignments as CSV */
function exportSingleFacultyCsv(fac) {
  const header = [
    'Faculty Name', 'Department', 'Designation', 'Employment Type', 'Phone',
    'Date', 'Session', 'Course Code', 'Course Name', 'Allocation Type',
  ];
  const rows = fac.assignments.map(a => [
    fac.name, fac.department, fac.designation, fac.employmentType, fac.phone,
    a.date, a.session, a.courseCode, a.courseName, a.allocationType,
  ]);
  const csv = [header, ...rows].map(r => r.map(escapeCsv).join(',')).join('\r\n');
  const safe = fac.name.replace(/[^a-zA-Z0-9_]/g, '_');
  downloadCsv(csv, `invigilation_${safe}.csv`);
}

/** Export ALL faculty-wise data as one combined CSV */
function exportAllFacultyCsv(facultyWise) {
  const header = [
    'Faculty Name', 'Department', 'Designation', 'Employment Type', 'Phone',
    'Date', 'Session', 'Course Code', 'Course Name', 'Allocation Type',
  ];
  const rows = [];
  facultyWise.forEach(fac => {
    fac.assignments.forEach(a => {
      rows.push([
        fac.name, fac.department, fac.designation, fac.employmentType, fac.phone,
        a.date, a.session, a.courseCode, a.courseName, a.allocationType,
      ]);
    });
  });
  const csv = [header, ...rows].map(r => r.map(escapeCsv).join(',')).join('\r\n');
  downloadCsv(csv, `invigilation_faculty_wise_all.csv`);
  toast.success('Faculty-wise CSV exported!');
}

export default function ReportPage() {
  const api = useApi();
  const [matrixData,      setMatrixData]      = useState({ slots: [], faculty: [], allocMap: {} });
  const [report,          setReport]          = useState([]);
  const [summary,         setSummary]         = useState([]);
  const [dateWise,        setDateWise]        = useState([]);
  const [facultyWise,     setFacultyWise]     = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [tab,             setTab]             = useState('matrix');
  const [search,          setSearch]          = useState('');
  const [matrixSearch,    setMatrixSearch]    = useState('');
  const [matrixOnlyActive,setMatrixOnlyActive]= useState(false);
  const [facSearch,       setFacSearch]       = useState('');
  const [downloading,     setDL]              = useState(false);
  const [expandedDate,    setExpandedDate]    = useState(null);
  const [expandedFaculty, setExpandedFaculty] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/report/matrix'),
      api.get('/report?format=json'),
      api.get('/report/summary'),
      api.get('/report/date-wise'),
      api.get('/report/faculty-wise'),
    ])
      .then(([mat, r, s, dw, fw]) => {
        setMatrixData(mat || { slots: [], faculty: [], allocMap: {} });
        setReport(r.data || []);
        setSummary(s || []);
        setDateWise(dw || []);
        setFacultyWise(fw || []);
        setLoading(false);
      })
      .catch(e => {
        toast.error(e.message);
        setLoading(false);
      });
  }, []);

  // ── CSV Export Handlers ──────────────────────────────────────
  const handleExportMatrix = async () => {
    setDL(true);
    try {
      await api.download('/report/matrix?format=csv', 'invigilation_matrix_report.csv');
      toast.success('Matrix CSV downloaded!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDL(false);
    }
  };

  const handleExportAllocations = async () => {
    setDL(true);
    try {
      await api.download('/report?type=allocations&format=csv', 'invigilation_allocation_table.csv');
      toast.success('Allocation Table CSV downloaded!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDL(false);
    }
  };

  const handleExportDateWise = async () => {
    setDL(true);
    try {
      await api.download('/report/date-wise?format=csv', 'invigilation_date_wise.csv');
      toast.success('Date-wise CSV downloaded!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDL(false);
    }
  };

  const handleExportFacultyWise = async () => {
    setDL(true);
    try {
      await api.download('/report/faculty-wise?format=csv', 'invigilation_faculty_wise_all.csv');
      toast.success('Faculty-wise CSV downloaded!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDL(false);
    }
  };

  const handleDownloadActive = () => {
    if (tab === 'matrix' || tab === 'workload') return handleExportMatrix();
    if (tab === 'allocations') return handleExportAllocations();
    if (tab === 'datewise') return handleExportDateWise();
    if (tab === 'facultywise') return handleExportFacultyWise();
  };

  // ── Filtered Data ───────────────────────────────────────────
  const filtered = report.filter(r =>
    !search || Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  const filteredFaculty = facultyWise.filter(f =>
    !facSearch ||
    f.name.toLowerCase().includes(facSearch.toLowerCase()) ||
    (f.department || '').toLowerCase().includes(facSearch.toLowerCase())
  );

  const filteredMatrixFaculty = (matrixData.faculty || []).filter(f => {
    const q = matrixSearch.toLowerCase();
    const matchesSearch = !q ||
      f.name.toLowerCase().includes(q) ||
      (f.department || '').toLowerCase().includes(q) ||
      (f.phone || '').includes(q);
    if (!matchesSearch) return false;

    if (matrixOnlyActive) {
      const hasAnyDuty = (matrixData.slots || []).some(
        s => Boolean(matrixData.allocMap?.[f.id]?.[`${s.date}||${s.time}`])
      );
      if (!hasAnyDuty) return false;
    }
    return true;
  });

  const maxDuty = summary.length ? Math.max(...summary.map(f => f.duty_count), 1) : 1;

  const TABS = [
    ['matrix',      '⊞ Matrix Report'],
    ['allocations', '📋 Allocation Table'],
    ['datewise',    '📅 Date-wise'],
    ['facultywise', '👤 Faculty-wise'],
    ['workload',    '📊 Workload'],
  ];

  const inputStyle = {
    padding: '9px 14px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 13,
    outline: 'none',
    width: 320,
  };

  const primaryBtnStyle = (bg = 'linear-gradient(135deg, #059669, #10b981)', shadow = 'rgba(16,185,129,0.3)') => ({
    padding: '9px 18px',
    background: bg,
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: downloading ? 'not-allowed' : 'pointer',
    boxShadow: `0 4px 14px ${shadow}`,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
  });

  const exportBtnLabel = {
    matrix:      '⬇️ Export Matrix CSV',
    allocations: '⬇️ Export Allocation Table CSV',
    datewise:    '⬇️ Export Date-wise CSV',
    facultywise: '⬇️ Export Faculty-wise CSV',
    workload:    '⬇️ Export Matrix CSV',
  }[tab] || '⬇️ Export CSV';

  return (
    <div style={{ padding: 32, color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Reports</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
            {matrixData.slots?.length || 0} exam slots · {report.length} assignments · {summary.length} faculty · {dateWise.length} exam days
          </p>
        </div>
        <button
          onClick={handleDownloadActive}
          disabled={downloading}
          style={{
            ...primaryBtnStyle(),
            padding: '11px 24px',
            fontSize: 14,
            borderRadius: 12,
          }}
        >
          {downloading ? '⏳ Exporting...' : exportBtnLabel}
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Duties',           value: report.length,                                                 color: '#6366f1' },
          { label: 'Faculty Active',         value: summary.filter(f => f.duty_count > 0).length,                 color: '#22c55e' },
          { label: 'Subject Faculty Duties', value: report.filter(r => r['Is Subject Faculty'] === 'YES').length, color: '#f59e0b' },
          { label: 'Exam Slots',             value: matrixData.slots?.length || 0,                                color: '#06b6d4' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 18 }}>
            <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 26, fontWeight: 700, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#0f172a', padding: 4, borderRadius: 10, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '8px 20px',
              background: tab === k ? '#1e293b' : 'transparent',
              border: tab === k ? '1px solid #334155' : '1px solid transparent',
              borderRadius: 8,
              color: tab === k ? '#e2e8f0' : '#64748b',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === k ? 600 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Loading report data...</p>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════ */}
          {/* ── 1. Matrix Report Tab (Given Format) ─────────────────── */}
          {/* ══════════════════════════════════════════════════════════ */}
          {tab === 'matrix' && (
            <div>
              {/* Matrix Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 14 }}>🔍</span>
                    <input
                      value={matrixSearch}
                      onChange={e => setMatrixSearch(e.target.value)}
                      placeholder="Search faculty by name, department, phone..."
                      style={{ ...inputStyle, paddingLeft: 34 }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={matrixOnlyActive}
                      onChange={e => setMatrixOnlyActive(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: '#6366f1' }}
                    />
                    Only show faculty with duties
                  </label>
                  <span style={{ color: '#64748b', fontSize: 12 }}>
                    Showing {filteredMatrixFaculty.length} of {matrixData.faculty?.length || 0} faculty
                  </span>
                </div>

                <button
                  onClick={handleExportMatrix}
                  disabled={downloading}
                  style={primaryBtnStyle('linear-gradient(135deg,#059669,#10b981)', 'rgba(16,185,129,0.3)')}
                >
                  {downloading ? '⏳ Exporting...' : '⬇️ Export Matrix CSV (Given Format)'}
                </button>
              </div>

              {/* Matrix Grid Table */}
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      <th style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155', position: 'sticky', left: 0, background: '#0f172a', zIndex: 2, minWidth: 44 }}>
                        Sr.No.
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155', position: 'sticky', left: 44, background: '#0f172a', zIndex: 2, minWidth: 200 }}>
                        Faculty Name
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155', minWidth: 100 }}>
                        Department
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155', minWidth: 110 }}>
                        Mobile No.
                      </th>
                      {(matrixData.slots || []).map(s => (
                        <th key={`${s.date}-${s.time}`} style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b', borderBottom: '1px solid #334155', minWidth: 130 }}>
                          <div style={{ color: '#a5b4fc', fontWeight: 600, fontSize: 11 }}>{s.date}</div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{s.time}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatrixFaculty.map((f, i) => {
                      const row = (matrixData.slots || []).map(s => matrixData.allocMap?.[f.id]?.[`${s.date}||${s.time}`] || '');
                      const hasAny = row.some(Boolean);
                      return (
                        <tr key={f.id || i} style={{ borderBottom: '1px solid #1e293b', opacity: hasAny ? 1 : 0.45 }}>
                          <td style={{ padding: '10px 14px', color: '#64748b', position: 'sticky', left: 0, background: hasAny ? '#1e293b' : '#182230', zIndex: 1, fontFamily: 'monospace' }}>
                            {i + 1}
                          </td>
                          <td style={{ padding: '10px 14px', position: 'sticky', left: 44, background: hasAny ? '#1e293b' : '#182230', zIndex: 1 }}>
                            <div style={{ fontWeight: hasAny ? 600 : 400, color: hasAny ? '#e2e8f0' : '#64748b' }}>{f.name}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
                            {f.department}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>
                            {f.phone || '—'}
                          </td>
                          {row.map((val, ci) => (
                            <td key={ci} style={{ padding: '10px 10px', textAlign: 'center' }}>
                              {val === 'S*' && (
                                <span style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '2px 8px', borderRadius: 6, fontWeight: 700, border: '1px solid rgba(99,102,241,0.4)', fontSize: 11 }} title="Subject Faculty (Own Course)">
                                  S*
                                </span>
                              )}
                              {val === 'S' && (
                                <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: 6, fontWeight: 600, border: '1px solid rgba(34,197,94,0.3)', fontSize: 11 }} title="Invigilator Assigned">
                                  S
                                </span>
                              )}
                              {!val && <span style={{ color: '#334155' }}>·</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredMatrixFaculty.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>
                    {(matrixData.faculty || []).length === 0 ? 'No faculty found. Add faculty and generate allocations first.' : 'No faculty match your search.'}
                  </p>
                )}

                {/* Matrix Legend */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid #334155', color: '#94a3b8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '2px 8px', borderRadius: 6, fontWeight: 700, border: '1px solid rgba(99,102,241,0.4)', fontSize: 11 }}>S*</span>
                    <span>= Own subject faculty</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: 6, fontWeight: 600, border: '1px solid rgba(34,197,94,0.3)', fontSize: 11 }}>S</span>
                    <span>= Invigilator assigned</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ── 2. Allocation Table Tab ─────────────────────────────── */}
          {/* ══════════════════════════════════════════════════════════ */}
          {tab === 'allocations' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by faculty, course, date..."
                  style={inputStyle}
                />
                <button
                  onClick={handleExportAllocations}
                  disabled={downloading}
                  style={primaryBtnStyle('linear-gradient(135deg, #4f46e5, #6366f1)', 'rgba(99,102,241,0.35)')}
                >
                  {downloading ? '⏳ Exporting...' : '⬇️ Export Allocation Table CSV'}
                </button>
              </div>

              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      {COLS.map(c => (
                        <th
                          key={c.key}
                          style={{
                            color: '#64748b',
                            fontWeight: 500,
                            textAlign: 'left',
                            padding: '11px 14px',
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            whiteSpace: 'nowrap',
                            minWidth: c.w,
                          }}
                        >
                          {c.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td style={{ ...td, color: '#818cf8', fontFamily: 'monospace', fontWeight: 700 }}>{r['Course Code']}</td>
                        <td style={td}>{r['Course Name']}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{r['Day and Date']}</td>
                        <td style={td}>
                          <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: r['Time'].includes('AM') ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: r['Time'].includes('AM') ? '#22c55e' : '#f59e0b' }}>
                            {r['Time'].includes('AM') ? 'FN' : 'AN'}
                          </span>
                          <span style={{ color: '#64748b', fontSize: 11, marginLeft: 6 }}>{r['Time']}</span>
                        </td>
                        <td style={{ ...td, fontWeight: 600, color: '#e2e8f0' }}>{r['Faculty Name']}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{r['Mobile No.']}</td>
                        <td style={{ ...td, color: '#94a3b8' }}>{r['Department']}</td>
                        <td style={td}>
                          {r['Is Subject Faculty'] === 'YES' && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>⭐ SUBJECT</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>
                    {report.length === 0 ? 'No allocations yet. Generate allocations first.' : 'No results match your search.'}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ── 3. Date-wise Tab ────────────────────────────────────── */}
          {/* ══════════════════════════════════════════════════════════ */}
          {tab === 'datewise' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button
                  onClick={handleExportDateWise}
                  disabled={downloading}
                  style={primaryBtnStyle('linear-gradient(135deg, #0891b2, #06b6d4)', 'rgba(6,182,212,0.3)')}
                >
                  {downloading ? '⏳ Exporting...' : '⬇️ Export Date-wise CSV'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {dateWise.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: 32 }}>No allocations yet.</p>}
                {dateWise.map((day, di) => (
                  <div key={di} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
                    <div
                      onClick={() => setExpandedDate(expandedDate === di ? null : di)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer', background: expandedDate === di ? '#243049' : '#1e293b', transition: 'background 0.2s' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: 15, color: '#fff' }}>
                          📅 {day.date}
                        </div>
                        <div style={{ color: '#64748b', fontSize: 13 }}>
                          {day.sessions.reduce((acc, s) => acc + s.exams.reduce((a, e) => a + e.faculties.length, 0), 0)} assignments across{' '}
                          {day.sessions.reduce((a, s) => a + s.exams.length, 0)} exam(s)
                        </div>
                      </div>
                      <span style={{ color: '#6366f1', fontSize: 18 }}>{expandedDate === di ? '▲' : '▼'}</span>
                    </div>

                    {expandedDate === di && (
                      <div style={{ padding: '0 20px 20px' }}>
                        {day.sessions.map((sess, si) => (
                          <div key={si} style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                              {sessionBadge(sess.session)}
                              <span style={{ color: '#64748b', fontSize: 12 }}>{sess.time}</span>
                            </div>
                            {sess.exams.map((exam, ei) => (
                              <div key={ei} style={{ background: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 10, border: '1px solid #1e3a5f' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                  <span style={{ fontFamily: 'monospace', color: '#818cf8', fontWeight: 700, fontSize: 13 }}>{exam.courseCode}</span>
                                  <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{exam.courseName}</span>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                  <thead>
                                    <tr>
                                      {['Faculty Name','Department','Designation','Phone','Allocation Type'].map(h => (
                                        <th key={h} style={{ color: '#475569', fontWeight: 500, textAlign: 'left', padding: '6px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1e293b' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {exam.faculties.map((f, fi) => (
                                      <tr key={fi}>
                                        <td style={{ padding: '8px 10px', color: '#e2e8f0', fontWeight: 600 }}>{f.name}</td>
                                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{f.department}</td>
                                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{f.designation}</td>
                                        <td style={{ padding: '8px 10px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>{f.phone || '—'}</td>
                                        <td style={{ padding: '8px 10px' }}>{allocBadge(f.allocationType)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ── 4. Faculty-wise Tab ─────────────────────────────────── */}
          {/* ══════════════════════════════════════════════════════════ */}
          {tab === 'facultywise' && (
            <>
              {/* Toolbar: search + export all */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 15 }}>🔍</span>
                  <input
                    value={facSearch}
                    onChange={e => setFacSearch(e.target.value)}
                    placeholder="Search faculty by name or department..."
                    style={{ ...inputStyle, paddingLeft: 34 }}
                  />
                </div>
                <button
                  onClick={handleExportFacultyWise}
                  disabled={downloading}
                  style={primaryBtnStyle('linear-gradient(135deg,#4f46e5,#6366f1)', 'rgba(99,102,241,0.35)')}
                >
                  {downloading ? '⏳ Exporting...' : '⬇️ Export All Faculty-wise CSV'}
                </button>
              </div>

              {filteredFaculty.length === 0 && (
                <p style={{ color: '#64748b', textAlign: 'center', padding: 32 }}>
                  {facultyWise.length === 0 ? 'No allocations yet.' : 'No faculty match your search.'}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredFaculty.map((fac, fi) => (
                  <div key={fi} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
                    {/* Faculty header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', flexWrap: 'wrap', gap: 12 }}>
                      <div
                        onClick={() => setExpandedFaculty(expandedFaculty === fi ? null : fi)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', flex: 1, minWidth: 240 }}
                      >
                        <div style={{ background: 'linear-gradient(135deg,#0891b2,#06b6d4)', width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 17, flexShrink: 0 }}>
                          {fac.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{fac.name}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{fac.department} · {fac.designation} · {fac.employmentType}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#6366f1', fontWeight: 700, fontSize: 20 }}>{fac.assignments.length}</div>
                          <div style={{ color: '#64748b', fontSize: 11 }}>duties</div>
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            exportSingleFacultyCsv(fac);
                            toast.success(`CSV exported for ${fac.name}`);
                          }}
                          title={`Export CSV for ${fac.name}`}
                          style={{
                            padding: '7px 13px',
                            background: 'rgba(99,102,241,0.15)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: 8,
                            color: '#818cf8',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ⬇️ CSV
                        </button>
                        <span
                          onClick={() => setExpandedFaculty(expandedFaculty === fi ? null : fi)}
                          style={{ color: '#6366f1', fontSize: 18, cursor: 'pointer' }}
                        >
                          {expandedFaculty === fi ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {/* Assignments table */}
                    {expandedFaculty === fi && (
                      <div style={{ padding: '0 20px 20px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 4 }}>
                          <thead>
                            <tr style={{ background: '#0f172a' }}>
                              {['Date','Session','Course Code','Course Name','Allocation Type'].map(h => (
                                <th key={h} style={{ color: '#475569', fontWeight: 500, textAlign: 'left', padding: '9px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fac.assignments.map((a, ai) => (
                              <tr key={ai} style={{ background: ai % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                <td style={{ ...td, whiteSpace: 'nowrap', color: '#e2e8f0' }}>{a.date}</td>
                                <td style={td}>{sessionBadge(a.session)}</td>
                                <td style={{ ...td, fontFamily: 'monospace', color: '#818cf8', fontWeight: 700 }}>{a.courseCode}</td>
                                <td style={{ ...td, color: '#cbd5e1' }}>{a.courseName}</td>
                                <td style={td}>{allocBadge(a.allocationType)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ── 5. Workload Tab ─────────────────────────────────────── */}
          {/* ══════════════════════════════════════════════════════════ */}
          {tab === 'workload' && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ color: '#f1f5f9', margin: 0, fontSize: 16 }}>Faculty Workload Distribution</h3>
                <button
                  onClick={handleExportMatrix}
                  disabled={downloading}
                  style={primaryBtnStyle('linear-gradient(135deg, #059669, #10b981)', 'rgba(16,185,129,0.3)')}
                >
                  {downloading ? '⏳ Exporting...' : '⬇️ Export Matrix CSV'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...summary].sort((a, b) => b.duty_count - a.duty_count).map(f => {
                  const pct    = (f.duty_count / maxDuty) * 100;
                  const capPct = (f.duty_count / f.max_duty) * 100;
                  const over   = f.duty_count >= f.max_duty;
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 200, flexShrink: 0 }}>
                        <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{f.name}</div>
                        <div style={{ color: '#64748b', fontSize: 11 }}>{f.department}</div>
                      </div>
                      <div style={{ flex: 1, background: '#0f172a', borderRadius: 6, height: 16, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 6,
                          background: over ? 'linear-gradient(90deg,#ef4444,#f87171)' : capPct > 70 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ width: 70, textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ color: over ? '#f87171' : '#e2e8f0', fontWeight: 700 }}>{f.duty_count}</span>
                        <span style={{ color: '#64748b', fontSize: 12 }}>/{f.max_duty}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

