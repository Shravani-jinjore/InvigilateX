// frontend/src/pages/admin/AdminDashboard.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import toast from 'react-hot-toast';

const StatCard = ({ icon, label, value, color, link }) => (
  <Link to={link || '#'} style={{ textDecoration: 'none' }}>
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 16,
      padding: 24,
      cursor: 'pointer',
      transition: 'border-color 0.2s, transform 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: `${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ color: '#64748b', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 700, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  </Link>
);

export default function AdminDashboard() {
  const api = useApi();
  const [stats, setStats] = useState({ faculty: 0, exams: 0, allocations: 0 });
  const [recentAlloc, setRecentAlloc] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/faculty'),
      api.get('/exams'),
      api.get('/allocations'),
    ]).then(([fac, exams, alloc]) => {
      setStats({ faculty: fac.length, exams: exams.length, allocations: alloc.length });
      setRecentAlloc(alloc.slice(0, 8));
      setLoading(false);
    }).catch(err => { toast.error(err.message); setLoading(false); });
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await api.post('/generate-allocation', {});
      toast.success(`✅ Generated! ${result.totalAssigned} assignments across ${result.examsProcessed} exams`);
      // Refresh
      const alloc = await api.get('/allocations');
      setStats(s => ({ ...s, allocations: alloc.length }));
      setRecentAlloc(alloc.slice(0, 8));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div style={{ padding: 32, color: '#e2e8f0' }}>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Admin Dashboard</h1>
          <p style={{ color: '#64748b', marginTop: 4 }}>Manage faculty, exams, and generate duty allocations</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: '12px 28px',
            background: generating ? '#4338ca' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', borderRadius: 12,
            color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: generating ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
          }}
        >
          {generating ? '⚙️ Generating...' : '⚡ Generate Allocations'}
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon="👥" label="Faculty Members" value={stats.faculty} color="#6366f1" link="/admin/faculty" />
        <StatCard icon="📅" label="Exam Slots" value={stats.exams} color="#22c55e" link="/admin/exams" />
        <StatCard icon="✅" label="Allocations" value={stats.allocations} color="#f59e0b" link="/admin/allocations" />
        <StatCard icon="📊" label="Reports" value="View" color="#ec4899" link="/admin/report" />
      </div>

      {/* Quick Actions */}
      <div style={{
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 16, padding: 24, marginBottom: 24,
      }}>
        <h3 style={{ color: '#f1f5f9', margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: '+ Add Faculty', path: '/admin/faculty', color: '#6366f1' },
            { label: '+ Add Exam', path: '/admin/exams', color: '#22c55e' },
            { label: '📤 Upload CSV', path: '/admin/upload', color: '#f59e0b' },
            { label: '📊 Download Report', path: '/admin/report', color: '#ec4899' },
          ].map(action => (
            <Link key={action.path} to={action.path} style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '10px 20px',
                background: `${action.color}22`,
                border: `1px solid ${action.color}44`,
                borderRadius: 10, color: action.color,
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>
                {action.label}
              </button>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Allocations */}
      {recentAlloc.length > 0 && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
          <h3 style={{ color: '#f1f5f9', margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
            Recent Allocations
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Faculty', 'Department', 'Date', 'Session', 'Subject', 'Course'].map(h => (
                  <th key={h} style={{ color: '#64748b', fontWeight: 500, textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #334155', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentAlloc.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={tdStyle}>{a.faculty?.name}</td>
                  <td style={tdStyle}>{a.faculty?.department}</td>
                  <td style={tdStyle}>{a.exam?.date}</td>
                  <td style={{ ...tdStyle }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: a.exam?.session === 'FN' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      color: a.exam?.session === 'FN' ? '#22c55e' : '#f59e0b',
                    }}>{a.exam?.session}</span>
                  </td>
                  <td style={tdStyle}>{a.exam?.subject_name}</td>
                  <td style={{ ...tdStyle, color: '#6366f1' }}>{a.exam?.course_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const tdStyle = { padding: '10px 12px', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.05)' };

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b', fontSize: 16 }}>
      Loading dashboard...
    </div>
  );
}
