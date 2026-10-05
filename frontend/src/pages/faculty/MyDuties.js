// frontend/src/pages/faculty/MyDuties.js
import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

export default function MyDuties() {
  const api = useApi();
  const { session } = useAuth();
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | upcoming | past

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id) return;
      const { data: fac } = await supabase.from('faculty').select('id').eq('user_id', session.user.id).single();
      if (!fac) { setLoading(false); return; }
      const data = await api.get(`/allocations?faculty_id=${fac.id}`);
      // Sort by date
      data.sort((a, b) => a.exam?.date?.localeCompare(b.exam?.date));
      setDuties(data);
      setLoading(false);
    };
    load().catch(e => { toast.error(e.message); setLoading(false); });
  }, [session]);

  const todayStr = new Date().toISOString().split('T')[0];
  const filtered = duties.filter(d => {
    if (filter === 'upcoming') return d.exam?.date >= todayStr;
    if (filter === 'past') return d.exam?.date < todayStr;
    return true;
  });

  return (
    <div style={{ padding: 32, color: '#e2e8f0' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>My Invigilation Duties</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>{duties.length} total duties assigned</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#0f172a', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {[['all', `All (${duties.length})`], ['upcoming', `Upcoming (${duties.filter(d => d.exam?.date >= todayStr).length})`], ['past', `Past (${duties.filter(d => d.exam?.date < todayStr).length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '8px 18px',
            background: filter === key ? '#1e293b' : 'transparent',
            border: filter === key ? '1px solid #334155' : '1px solid transparent',
            borderRadius: 8, color: filter === key ? '#e2e8f0' : '#64748b',
            cursor: 'pointer', fontSize: 13, fontWeight: filter === key ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Loading your duties...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b', background: '#1e293b', border: '1px solid #334155', borderRadius: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p>{duties.length === 0 ? 'No duties assigned yet. The admin will generate allocations soon.' : 'No duties in this filter.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(duty => {
            const isPast = duty.exam?.date < todayStr;
            const isToday = duty.exam?.date === todayStr;
            return (
              <div key={duty.id} style={{
                background: '#1e293b',
                border: `1px solid ${isToday ? '#6366f1' : isPast ? '#1e293b' : '#334155'}`,
                borderRadius: 14,
                padding: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                opacity: isPast ? 0.65 : 1,
              }}>
                {/* Date badge */}
                <div style={{
                  width: 64, height: 64, borderRadius: 14, flexShrink: 0,
                  background: isToday
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : isPast
                      ? '#1e293b'
                      : 'linear-gradient(135deg, #1e3a5f, #1e40af)',
                  border: isPast ? '1px solid #334155' : 'none',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: isToday ? '#c7d2fe' : '#60a5fa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                    {new Date(duty.exam?.date + 'T00:00:00').toLocaleDateString('en', { month: 'short' })}
                  </span>
                  <span style={{ color: '#fff', fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>
                    {new Date(duty.exam?.date + 'T00:00:00').getDate()}
                  </span>
                  <span style={{ color: isToday ? '#c7d2fe' : '#60a5fa', fontSize: 9 }}>
                    {new Date(duty.exam?.date + 'T00:00:00').getFullYear()}
                  </span>
                </div>

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 16 }}>{duty.exam?.subject_name}</span>
                    {isToday && <span style={{ padding: '2px 8px', background: '#6366f1', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#fff' }}>TODAY</span>}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>
                    <span style={{ fontFamily: 'monospace', color: '#818cf8' }}>{duty.exam?.course_code}</span>
                    {' · '}Rooms: {duty.exam?.rooms_required}
                  </div>
                </div>

                {/* Session badge */}
                <div style={{
                  padding: '8px 18px', borderRadius: 20, fontWeight: 700, fontSize: 14,
                  background: duty.exam?.session === 'FN' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                  color: duty.exam?.session === 'FN' ? '#22c55e' : '#f59e0b',
                  flexShrink: 0,
                }}>
                  {duty.exam?.session === 'FN' ? '🌅 Forenoon' : '🌇 Afternoon'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
