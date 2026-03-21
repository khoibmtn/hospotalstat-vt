import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DataEntryPage from './pages/DataEntryPage';
import SummaryPage from './pages/SummaryPage';
import LockManagementPage from './pages/LockManagementPage';
import SettingsPage from './pages/SettingsPage';
import { ROLES } from './utils/constants';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center animate-pulse">
          <div className="text-4xl mb-3">🏥</div>
          <div className="text-slate-500 font-medium">Đang tải...</div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.approved) {
    return (
      <div className="flex items-center justify-center min-h-screen p-5 bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-center max-w-md w-full">
          <div className="text-4xl mb-3">⏳</div>
          <h2 className="text-xl font-bold mb-2 text-slate-900">Chờ phê duyệt</h2>
          <p className="text-slate-500 mb-6">
            Tài khoản của bạn đang chờ quản trị viên phê duyệt.
          </p>
          <button 
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md transition-colors" 
            onClick={() => window.location.reload()}
          >
            Kiểm tra lại
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/data-entry" element={<DataEntryPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route
          path="/lock-management"
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.KEHOACH]}>
              <LockManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
