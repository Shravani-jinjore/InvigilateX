// frontend/src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import FacultyManagement from './pages/admin/FacultyManagement';
import ExamSchedule from './pages/admin/ExamSchedule';
import UploadTimetable from './pages/admin/UploadTimetable';
import AllocationsView from './pages/admin/AllocationsView';
import ReportPage from './pages/admin/ReportPage';
import ReExamModule from './pages/admin/ReExamModule';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import AvailabilityCalendar from './pages/faculty/AvailabilityCalendar';
import SubjectsPage from './pages/faculty/SubjectsPage';
import MyDuties from './pages/faculty/MyDuties';

// Full-screen message helper
const Screen = ({ children, color = '#64748b' }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '100vh',
    background: '#0f172a', color, fontSize: 16, gap: 12,
  }}>
    {children}
  </div>
);

function ProtectedRoute({ children, requiredRole }) {
  const { session, role, loading } = useAuth();

  if (loading) return <Screen>⏳ Loading...</Screen>;
  if (!session) return <Navigate to="/login" replace />;
  if (!role) return (
    <Screen color="#f87171">
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div>Role not found in database.</div>
      <div style={{ fontSize: 13, color: '#64748b' }}>
        Make sure your user exists in the <code>public.users</code> table with role = 'admin'.
      </div>
    </Screen>
  );
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/faculty'} replace />;
  }
  return <Layout>{children}</Layout>;
}

function RootRedirect() {
  const { session, role, loading } = useAuth();

  if (loading) return <Screen>⏳ Loading...</Screen>;
  if (!session) return <Navigate to="/login" replace />;
  if (!role) return (
    <Screen color="#f87171">
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div>Your account has no role assigned.</div>
      <div style={{ fontSize: 13, color: '#64748b', maxWidth: 400, textAlign: 'center' }}>
        Go to Supabase → Table Editor → public.users and make sure your user ID is there with role = 'admin'.
      </div>
    </Screen>
  );

  return <Navigate to={role === 'admin' ? '/admin' : '/faculty'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b', color: '#e2e8f0',
              border: '1px solid #334155', borderRadius: 10, fontSize: 14,
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#1e293b' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/faculty" element={<ProtectedRoute requiredRole="admin"><FacultyManagement /></ProtectedRoute>} />
          <Route path="/admin/exams" element={<ProtectedRoute requiredRole="admin"><ExamSchedule /></ProtectedRoute>} />
          <Route path="/admin/upload" element={<ProtectedRoute requiredRole="admin"><UploadTimetable /></ProtectedRoute>} />
          <Route path="/admin/allocations" element={<ProtectedRoute requiredRole="admin"><AllocationsView /></ProtectedRoute>} />
          <Route path="/admin/report" element={<ProtectedRoute requiredRole="admin"><ReportPage /></ProtectedRoute>} />
          <Route path="/admin/reexam" element={<ProtectedRoute requiredRole="admin"><ReExamModule /></ProtectedRoute>} />

          <Route path="/faculty" element={<ProtectedRoute requiredRole="faculty"><FacultyDashboard /></ProtectedRoute>} />
          <Route path="/faculty/availability" element={<ProtectedRoute requiredRole="faculty"><AvailabilityCalendar /></ProtectedRoute>} />
          <Route path="/faculty/subjects" element={<ProtectedRoute requiredRole="faculty"><SubjectsPage /></ProtectedRoute>} />
          <Route path="/faculty/duties" element={<ProtectedRoute requiredRole="faculty"><MyDuties /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
