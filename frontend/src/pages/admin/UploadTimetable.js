// frontend/src/pages/admin/UploadTimetable.js
import React, { useState, useRef } from 'react';
import { useApi } from '../../hooks/useApi';
import toast from 'react-hot-toast';

export default function UploadTimetable() {
  const api = useApi();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleFile = (f) => {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'xls', 'xlsx'].includes(ext)) {
      toast.error('Only CSV and Excel files accepted');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return toast.error('Select a file first');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload('/upload', fd);
      setResult(res);
      toast.success(res.message);
      setFile(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: 32, color: '#e2e8f0', maxWidth: 820 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Upload Timetable</h1>
      <p style={{ color: '#64748b', marginBottom: 28, fontSize: 14 }}>
        Upload your institution's exam timetable CSV or Excel file. The system auto-detects dates, sessions, and calculates rooms needed.
      </p>

      {/* Supported Format Card */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: '#a5b4fc', margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>
          ✅ Supported Column Format
        </h3>

        {/* Real format */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Timetable Format (auto-detected)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
              <thead>
                <tr>
                  {['Sr. No.', 'Code', 'Course Name', 'Day and Date', 'Time', 'Student Count', 'Faculty Name', 'Mobile No.', 'Count (+10)', 'COUNT'].map(h => (
                    <th key={h} style={{ background: '#0f172a', color: '#6366f1', padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #334155' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {['1', '6HS403', 'Engg. Economics', '"Thursday, 07/05/2026"', '10.30 AM to 12.30 PM', '216', 'Mr. Vishal Bhojani', '9920418496', '226', '216'].map((v, i) => (
                    <td key={i} style={{ padding: '6px 10px', color: '#94a3b8', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* How fields are mapped */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 14 }}>
          {[
            { from: 'Code', to: 'course_code', note: 'Uppercased automatically' },
            { from: 'Course Name', to: 'subject_name', note: 'Full subject name' },
            { from: 'Day and Date', to: 'date', note: '"Thu, 07/05/2026" → 2026-05-07' },
            { from: 'Time', to: 'session', note: 'AM start → FN, PM start → AN' },
            { from: 'COUNT', to: 'rooms_required', note: 'ceil(COUNT / 36) invigilators' },
          ].map(m => (
            <div key={m.from} style={{ background: '#0f172a', borderRadius: 8, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ color: '#6366f1', fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>{m.from}</span>
                <span style={{ color: '#475569', fontSize: 11 }}>→</span>
                <span style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: 12 }}>{m.to}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: 11 }}>{m.note}</div>
            </div>
          ))}
        </div>

        {/* Simple format note */}
        <div style={{ marginTop: 14, padding: 12, background: 'rgba(99,102,241,0.07)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.18)' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
            <strong style={{ color: '#a5b4fc' }}>Also supports simple format: </strong>
            <code style={{ color: '#67e8f9' }}>date, session, subject_name, course_code, rooms_required</code>
            {' '}with dates in YYYY-MM-DD and session as FN/AN.
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileRef.current.click()}
        style={{
          border: `2px dashed ${dragOver ? '#6366f1' : file ? '#22c55e' : '#334155'}`,
          borderRadius: 16,
          padding: 44,
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(99,102,241,0.05)' : file ? 'rgba(34,197,94,0.05)' : '#1e293b',
          transition: 'all 0.2s',
          marginBottom: 20,
        }}
      >
        <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
        <div style={{ fontSize: 42, marginBottom: 12 }}>{file ? '✅' : '📂'}</div>
        {file ? (
          <>
            <p style={{ color: '#22c55e', fontWeight: 700, margin: 0, fontSize: 16 }}>{file.name}</p>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB — ready to upload</p>
          </>
        ) : (
          <>
            <p style={{ color: '#e2e8f0', fontWeight: 600, margin: 0, fontSize: 16 }}>Drop your CSV or Excel timetable here</p>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>or click to browse · Max 10 MB</p>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        {file && (
          <button onClick={() => { setFile(null); setResult(null); }}
            style={{ padding: '11px 20px', background: '#334155', border: 'none', borderRadius: 10, color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>
            Clear
          </button>
        )}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            padding: '11px 28px',
            background: !file || uploading ? '#1e3a5f' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', borderRadius: 10,
            color: !file || uploading ? '#64748b' : '#fff',
            cursor: !file || uploading ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 600,
          }}
        >
          {uploading ? '⏳ Parsing & Importing...' : '📤 Upload & Import'}
        </button>
      </div>

      {/* Result Summary */}
      {result && (
        <div style={{ marginTop: 24, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: 20 }}>
          <h3 style={{ color: '#22c55e', margin: '0 0 14px', fontSize: 16 }}>✅ Import Successful</h3>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { label: 'Imported',     value: result.imported,     color: '#22c55e' },
              { label: 'Total Parsed', value: result.total_parsed,  color: '#6366f1' },
              { label: 'Skipped',      value: result.skipped || 0,  color: '#f59e0b' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ color: '#64748b', fontSize: 12 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 26, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>
          {/* Sample of what was imported */}
          {result.sample?.length > 0 && (
            <>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>Sample imported rows:</div>
              {result.sample.map((r, i) => (
                <div key={i} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 12, color: '#94a3b8' }}>
                  <span style={{ color: '#a5b4fc', fontFamily: 'monospace' }}>{r.course_code}</span>
                  {' — '}{r.subject_name}
                  {' · '}<span style={{ color: '#22c55e' }}>{r.date}</span>
                  {' '}<span style={{ color: r.session === 'FN' ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{r.session}</span>
                  {' · '}{r.rooms_required} invigilator{r.rooms_required > 1 ? 's' : ''}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
