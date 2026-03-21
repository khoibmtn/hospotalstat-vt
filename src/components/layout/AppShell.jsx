import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser } from '../../services/authService';
import { ROLES, ROLE_LABELS } from '../../utils/constants';

export default function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutUser();
    navigate('/login');
  }

  const isAdmin = user?.role === ROLES.ADMIN;
  const isKehoach = user?.role === ROLES.KEHOACH;
  const canManage = isAdmin || isKehoach;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__brand-icon">🏥</div>
          <div className="app-sidebar__brand-text">HospotalStat</div>
        </div>

        <nav className="app-sidebar__nav">
          <div className="app-sidebar__section-label">Tổng quan</div>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
          >
            <span className="nav-item__icon">📊</span>
            Dashboard
          </NavLink>

          <div className="app-sidebar__section-label">Nhập liệu</div>
          <NavLink
            to="/data-entry"
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
          >
            <span className="nav-item__icon">📝</span>
            Nhập số liệu
          </NavLink>

          <div className="app-sidebar__section-label">Thống kê</div>
          <NavLink
            to="/summary"
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
          >
            <span className="nav-item__icon">📋</span>
            Bảng tổng hợp
          </NavLink>

          {canManage && (
            <>
              <div className="app-sidebar__section-label">Quản lý</div>
              {canManage && (
                <NavLink
                  to="/lock-management"
                  className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
                >
                  <span className="nav-item__icon">🔒</span>
                  Khóa số liệu
                </NavLink>
              )}
              {isAdmin && (
                <NavLink
                  to="/settings"
                  className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
                >
                  <span className="nav-item__icon">⚙️</span>
                  Cài đặt
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="app-sidebar__footer">
          <div className="nav-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'default' }}>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontSize: '0.8125rem' }}>
              {user?.displayName}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)' }}>
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>
          <button className="nav-item" onClick={handleLogout} style={{ marginTop: '4px' }}>
            <span className="nav-item__icon">🚪</span>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
