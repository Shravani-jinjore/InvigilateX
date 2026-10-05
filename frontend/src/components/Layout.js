// frontend/src/components/Layout.js
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV_ADMIN = [
  { path: '/admin', label: 'Dashboard', icon: '🏠' },
  { path: '/admin/faculty', label: 'Faculty', icon: '👥' },
  { path: '/admin/exams', label: 'Exam Schedule', icon: '📅' },
  { path: '/admin/upload', label: 'Upload Timetable', icon: '📤' },
  { path: '/admin/reexam', label: 'Re-Exam', icon: '🔁' },
  { path: '/admin/allocations', label: 'Allocations', icon: '⚙️' },
  { path: '/admin/report', label: 'Reports', icon: '📊' },
];

const NAV_FACULTY = [
  { path: '/faculty', label: 'My Dashboard', icon: '🏠' },
  { path: '/faculty/availability', label: 'Set Availability', icon: '📆' },
  { path: '/faculty/subjects', label: 'My Subjects', icon: '📚' },
  { path: '/faculty/duties', label: 'My Duties', icon: '📋' },
];

export default function Layout({ children }) {
  const { role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = role === 'admin' ? NAV_ADMIN : NAV_FACULTY;

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : 64,
        background: '#1e293b',
        borderRight: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>📋</div>
          {sidebarOpen && (
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>InvigilateX</div>
              <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {role === 'admin' ? 'Administrator' : 'Faculty'}
              </div>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '16px 0' }}>
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  color: active ? '#a5b4fc' : '#94a3b8',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                  borderRight: active ? '3px solid #6366f1' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: '1px solid #334155' }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            {sidebarOpen ? '← Collapse' : '→'}
          </button>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              color: '#f87171',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {sidebarOpen ? '🚪 Sign Out' : '🚪'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
