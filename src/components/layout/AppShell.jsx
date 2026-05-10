import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser } from '../../services/authService';
import { getSettings } from '../../services/settingsService';
import { ROLES, ROLE_LABELS } from '../../utils/constants';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Menu, LayoutDashboard, Edit3, PieChart, Lock, Settings, LogOut, Hospital } from 'lucide-react';

export default function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const isTvMode = searchParams.get('mode') === 'tv';

  // Hospital branding from settings
  const [brandName, setBrandName] = useState('');
  const [brandIcon, setBrandIcon] = useState('');
  const [brandIconUrl, setBrandIconUrl] = useState('');

  useEffect(() => {
    getSettings().then((s) => {
      if (s.hospitalName) {
        setBrandName(s.hospitalName);
        document.title = `${s.hospitalName} — Số liệu KCB`;
      }
      if (s.hospitalIcon) setBrandIcon(s.hospitalIcon);
      if (s.hospitalIconUrl) setBrandIconUrl(s.hospitalIconUrl);
    }).catch(() => {});

    // Live sync when branding is changed in Settings
    const onBrandingUpdate = (e) => {
      const { hospitalName, hospitalIcon, hospitalIconUrl } = e.detail;
      if (hospitalName !== undefined) {
        setBrandName(hospitalName);
        document.title = hospitalName ? `${hospitalName} — Số liệu KCB` : 'Số liệu KCB';
      }
      if (hospitalIcon !== undefined) setBrandIcon(hospitalIcon);
      if (hospitalIconUrl !== undefined) setBrandIconUrl(hospitalIconUrl);
    };
    window.addEventListener('branding-updated', onBrandingUpdate);
    return () => window.removeEventListener('branding-updated', onBrandingUpdate);
  }, []);

  async function handleLogout() {
    await logoutUser();
    navigate('/login');
  }

  const isAdmin = user?.role === ROLES.ADMIN;
  const isKehoach = user?.role === ROLES.KEHOACH;
  const canManage = isAdmin || isKehoach;

  const displayName = brandName || 'Số liệu KCB';

  const brandingIcon = brandIconUrl ? (
    <img src={brandIconUrl} alt="" className="h-6 w-6 rounded object-contain" />
  ) : brandIcon ? (
    <span className="text-xl leading-none">{brandIcon}</span>
  ) : (
    <Hospital className="h-6 w-6 text-blue-400" />
  );

  const brandingIconSmall = brandIconUrl ? (
    <img src={brandIconUrl} alt="" className="h-5 w-5 rounded object-contain" />
  ) : brandIcon ? (
    <span className="text-lg leading-none">{brandIcon}</span>
  ) : (
    <Hospital className="h-5 w-5 text-blue-400" />
  );

  const navContent = (
    <div className="flex flex-col h-full bg-slate-900 text-white w-64 max-w-[80vw]">
      <div className="flex items-center gap-3 p-5 mb-4 border-b border-slate-800">
        <span className="shrink-0">{brandingIcon}</span>
        <span className="font-bold text-sm tracking-tight leading-snug break-words">{displayName}</span>
      </div>

      <nav className="flex-1 px-4 space-y-8 overflow-y-auto">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Tổng quan</div>
          <div className="space-y-1">
            <NavLink
              to="/"
              end
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
          </div>
        </div>

        <div>
           <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Nhập liệu</div>
           <div className="space-y-1">
              <NavLink
                to="/data-entry"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Edit3 className="h-4 w-4" />
                Nhập số liệu
              </NavLink>
              <NavLink
                to="/summary"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <PieChart className="h-4 w-4" />
                Bảng tổng hợp
              </NavLink>
           </div>
        </div>

        {canManage && (
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Quản lý</div>
            <div className="space-y-1">
              <NavLink
                to="/lock-management"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Lock className="h-4 w-4" />
                Khóa số liệu
              </NavLink>

              {isAdmin && (
                <NavLink
                  to="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Settings className="h-4 w-4" />
                  Cài đặt
                </NavLink>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 mt-auto shrink-0">
        <div className="flex flex-col gap-1 px-3 py-2 mb-2">
          <span className="text-sm font-semibold text-white truncate" title={user?.displayName}>{user?.displayName}</span>
          <span className="text-xs text-slate-400 truncate">{ROLE_LABELS[user?.role] || user?.role}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      {!isTvMode && (
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 text-white shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          {brandingIconSmall}
          <span className="font-bold tracking-tight text-sm leading-snug">{displayName}</span>
        </div>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-slate-800">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-r-slate-800 bg-transparent flex flex-col border-none shadow-none text-transparent w-auto">
            <SheetTitle className="sr-only">Menu Điều khiển</SheetTitle>
            {navContent}
          </SheetContent>
        </Sheet>
      </div>
      )}

      {/* Desktop Sidebar */}
      {!isTvMode && (
      <aside className="hidden md:flex w-64 shrink-0 shadow-xl z-10 sticky top-0 h-screen">
        {navContent}
      </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0 flex flex-col h-[calc(100vh-60px)] md:h-screen overflow-hidden bg-slate-50/50">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
