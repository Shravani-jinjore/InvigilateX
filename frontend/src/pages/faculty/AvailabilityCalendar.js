// frontend/src/pages/faculty/AvailabilityCalendar.js
// Calendar UI: Blue = available, Red = unavailable, click to toggle
import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toLocalDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function AvailabilityCalendar() {
  const api = useApi();
  const { session } = useAuth();
  const [facultyId, setFacultyId] = useState(null);
  const [availability, setAvailability] = useState({}); // { 'YYYY-MM-DD': 'available'|'unavailable' }
  const [today] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [saving, setSaving] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id) return;
      const { data: fac } = await supabase.from('faculty').select('id').eq('user_id', session.user.id).single();
      if (!fac) { toast.error('Faculty record not found'); setLoading(false); return; }
      setFacultyId(fac.id);

      const data = await api.get(`/availability?faculty_id=${fac.id}`);
      const map = {};
      data.forEach(r => { map[r.date] = r.status; });
      setAvailability(map);
      setLoading(false);
    };
    load().catch(e => { toast.error(e.message); setLoading(false); });
  }, [session]);

  const handleDayClick = async (dateStr) => {
    if (!facultyId) return;
    const current = availability[dateStr];
    // Cycle: none → available → unavailable → none (delete)
    let nextStatus;
    if (!current) nextStatus = 'available';
    else if (current === 'available') nextStatus = 'unavailable';
    else nextStatus = null; // remove

    setSaving(dateStr);
    try {
      if (nextStatus) {
        await api.post('/availability', { faculty_id: facultyId, date: dateStr, status: nextStatus });
        setAvailability(prev => ({ ...prev, [dateStr]: nextStatus }));
      } else {
        // Delete by refetching and finding the id
        const records = await api.get(`/availability?faculty_id=${facultyId}`);
        const rec = records.find(r => r.date === dateStr);
        if (rec) await api.del(`/availability/${rec.id}`);
        setAvailability(prev => { const n = { ...prev }; delete n[dateStr]; return n; });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  // Build calendar days for current viewDate month
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toLocalDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const availCount = Object.values(availability).filter(v => v === 'available').length;
  const unavailCount = Object.values(availability).filter(v => v === 'unavailable').length;

  return (
    <div style={{ padding: 32, color: '#e2e8f0', maxWidth: 700 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Set Availability</h1>
      <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
        Click dates to mark your availability. Cycle: <strong style={{ color: '#3b82f6' }}>Available</strong> → <strong style={{ color: '#ef4444' }}>Unavailable</strong> → Clear
      </p>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        {[
          { color: '#3b82f6', bg: 'rgba(59,130,246,0.2)', label: `Available (${availCount})` },
          { color: '#ef4444', bg: 'rgba(239,68,68,0.2)', label: `Unavailable (${unavailCount})` },
          { color: '#475569', bg: 'transparent', label: 'Not set' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: l.bg, border: `2px solid ${l.color}` }} />
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Card */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: 24 }}>
        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={prevMonth} style={navBtn}>‹</button>
          <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} style={navBtn}>›</button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', color: '#475569', fontSize: 12, fontWeight: 600, padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading calendar...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {/* Empty cells for first day offset */}
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = toLocalDateStr(year, month, day);
              const status = availability[dateStr];
              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;
              const isSaving = saving === dateStr;

              let bg = 'transparent';
              let border = '1px solid #334155';
              let color = isPast ? '#475569' : '#94a3b8';

              if (status === 'available') {
                bg = 'rgba(59,130,246,0.2)';
                border = '1px solid #3b82f6';
                color = '#93c5fd';
              } else if (status === 'unavailable') {
                bg = 'rgba(239,68,68,0.18)';
                border = '1px solid #ef4444';
                color = '#fca5a5';
              }

              if (isToday) border = '2px solid #6366f1';

              return (
                <button
                  key={day}
                  onClick={() => !isPast && handleDayClick(dateStr)}
                  disabled={isPast || isSaving}
                  style={{
                    background: isSaving ? 'rgba(99,102,241,0.2)' : bg,
                    border,
                    borderRadius: 8,
                    color: isSaving ? '#a5b4fc' : color,
                    padding: '8px 4px',
                    cursor: isPast ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: isToday ? 700 : 400,
                    transition: 'all 0.15s',
                    opacity: isPast ? 0.4 : 1,
                    position: 'relative',
                  }}
                >
                  {day}
                  {status && (
                    <div style={{
                      position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                      width: 4, height: 4, borderRadius: '50%',
                      background: status === 'available' ? '#3b82f6' : '#ef4444',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk actions */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 16, marginTop: 16 }}>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 10px' }}>
          Mark all weekdays this month as available:
        </p>
        <button
          onClick={async () => {
            if (!facultyId) return;
            const dates = [];
            for (let d = 1; d <= daysInMonth; d++) {
              const dateStr = toLocalDateStr(year, month, d);
              if (dateStr >= todayStr) {
                const dow = new Date(dateStr + 'T00:00:00').getDay();
                if (dow !== 0 && dow !== 6) dates.push({ date: dateStr, status: 'available' });
              }
            }
            setSaving('bulk');
            try {
              await api.post('/availability/bulk', { faculty_id: facultyId, dates });
              const map = { ...availability };
              dates.forEach(d => { map[d.date] = 'available'; });
              setAvailability(map);
              toast.success(`Marked ${dates.length} weekdays as available`);
            } catch (e) { toast.error(e.message); }
            finally { setSaving(null); }
          }}
          disabled={saving === 'bulk'}
          style={{ padding: '8px 18px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: '#60a5fa', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {saving === 'bulk' ? 'Saving...' : '✓ Mark All Weekdays Available'}
        </button>
      </div>
    </div>
  );
}

const navBtn = {
  width: 36, height: 36, borderRadius: 8,
  background: '#0f172a', border: '1px solid #334155',
  color: '#94a3b8', cursor: 'pointer', fontSize: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
