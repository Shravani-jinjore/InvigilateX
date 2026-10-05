// frontend/src/pages/faculty/FacultyDashboard.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

export default function FacultyDashboard() {
  const api = useApi();
  const { session } = useAuth();
  const [facultyRecord, setFacultyRecord] = useState(null);
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id) return;
      // Find the faculty record linked to this user
      const { data: fac } = await supabase
        .from('faculty')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (fac) {
        setFacultyRecord(fac);
        const allocs = await api.get(`/allocations?faculty_id=${fac.id}`);
        setDuties(allocs);
      }
      setLoading(false);
    };
    load().catch(e => { toast.error(e.message); setLoading(false); });
  }, [session]);

  const upcoming = duties
    .filter(d => d.exam?.date >= new Date().toISOString().split('T')[0])
    .sort((a, b) => a.exam?.date?.localeCompare(b.exam?.date));

  if (loading) return <div style={{ padding: 48, color: '#64748b', textAlign: 'center' }}>Loading...</div>;

  if (!facultyRecord) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ color: '#e2e8f0' }}>Profile Not Linked</h2>
      <p>Your account is not linked to a faculty record. Please contact the administrator.</p>
    </div>
  );

  return (
    <div style={{ padding: 32, color: '#e2e8f0' }}>
      {/* Welcome */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          Welcome, {facultyRecord.name} 👋
        </h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
          {facultyRecord.department} · {facultyRecord.designation}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Duties', value: duties.length, color: '#6366f1', icon: '📋' },
          { label: 'Upcoming', value: upcoming.length, color: '#22c55e', icon: '📅' },
          { label: 'Max Allowed', value: facultyRecord.max_duty, color: '#f59e0b', icon: '🔒' },
          { label: 'Remaining', value: Math.max(0, facultyRecord.max_duty - facultyRecord.duty_count), color: '#94a3b8', icon: '🎯' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 26, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: '#f1f5f9', margin: '0 0 14px', fontSize: 15, fontWeight: 600 }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '📆 Set Availability', path: '/faculty/availability', color: '#6366f1' },
            { label: '📚 Manage Subjects', path: '/faculty/subjects', color: '#22c55e' },
            { label: '📋 View All Duties', path: '/faculty/duties', color: '#f59e0b' },
          ].map(a => (
            <Link key={a.path} to={a.path} style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '10px 18px',
                background: `${a.color}18`,
                border: `1px solid ${a.color}33`,
                borderRadius: 10, color: a.color,
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>{a.label}</button>
            </Link>
          ))}
        </div>
      </div>

      {/* Upcoming Duties */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
        <h3 style={{ color: '#f1f5f9', margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
          Upcoming Duties ({upcoming.length})
        </h3>
        {upcoming.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 14 }}>No upcoming duties assigned yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.slice(0, 5).map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: '#0f172a', borderRadius: 10, padding: '12px 16px',
                border: '1px solid #1e3a5f',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 10,
                  background: 'linear-gradient(135deg, #1e3a5f, #1e40af)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700 }}>
                    {new Date(d.exam?.date + 'T00:00:00').toLocaleDateString('en', { month: 'short' }).toUpperCase()}
                  </span>
                  <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                    {new Date(d.exam?.date + 'T00:00:00').getDate()}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{d.exam?.subject_name}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>Course: {d.exam?.course_code}</div>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: d.exam?.session === 'FN' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                  color: d.exam?.session === 'FN' ? '#22c55e' : '#f59e0b',
                }}>
                  {d.exam?.session === 'FN' ? '🌅 Forenoon' : '🌇 Afternoon'}
                </span>
              </div>
            ))}
          </div>
        )}
        {upcoming.length > 5 && (
          <Link to="/faculty/duties" style={{ display: 'block', marginTop: 14, color: '#6366f1', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>
            View all {upcoming.length} upcoming duties →
          </Link>
        )}
      </div>
    </div>
  );
}
