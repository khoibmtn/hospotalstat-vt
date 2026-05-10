import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser, updateUser, updateUserPassword } from '../../services/authService';
import { getSettings } from '../../services/settingsService';
import { ROLES, ROLE_LABELS } from '../../utils/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Menu, LayoutDashboard, Edit3, PieChart, Lock, Settings, LogOut, Hospital, UserCog, Check, AlertCircle } from 'lucide-react';

export default function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const isTvMode = searchParams.get('mode') === 'tv';

  // Account dialog state
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [accountMsg, setAccountMsg] = useState({ type: '', text: '' });
  const [accountLoading, setAccountLoading] = useState(false);

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

  const openAccountDialog = () => {
    setEditName(user?.displayName || '');
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setAccountMsg({ type: '', text: '' });
    setAccountDialogOpen(true);
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setAccountLoading(true);
    try {
      await updateUser(user.uid, { displayName: editName.trim(), fullName: editName.trim() });
      setAccountMsg({ type: 'success', text: 'Đã cập nhật tên thành công.' });
      window.location.reload();
    } catch (err) {
      setAccountMsg({ type: 'error', text: err.message || 'Lỗi cập nhật tên.' });
    } finally {
      setAccountLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setAccountMsg({ type: '', text: '' });
    if (!currentPwd) { setAccountMsg({ type: 'error', text: 'Nhập mật khẩu hiện tại.' }); return; }
    if (newPwd.length < 6) { setAccountMsg({ type: 'error', text: 'Mật khẩu mới tối thiểu 6 ký tự.' }); return; }
    if (newPwd !== confirmPwd) { setAccountMsg({ type: 'error', text: 'Mật khẩu mới không khớp.' }); return; }
    setAccountLoading(true);
    try {
      await updateUserPassword(currentPwd, newPwd);
      setAccountMsg({ type: 'success', text: 'Đã đổi mật khẩu thành công!' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      setAccountMsg({ type: 'error', text: err.message || 'Lỗi đổi mật khẩu.' });
    } finally {
      setAccountLoading(false);
    }
  };

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
        <button
          onClick={openAccountDialog}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white mb-1 group"
        >
          <UserCog className="h-4 w-4 text-slate-400 group-hover:text-white" />
          <div className="flex flex-col items-start min-w-0">
            <span className="text-sm font-semibold text-white truncate max-w-full" title={user?.displayName}>{user?.displayName}</span>
            <span className="text-[10px] text-slate-500 truncate">{ROLE_LABELS[user?.role] || user?.role}</span>
          </div>
        </button>
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
      {/* Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UserCog className="w-5 h-5 text-blue-600" />
              Quản lý tài khoản
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {accountMsg.text && (
              <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium ${
                accountMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {accountMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {accountMsg.text}
              </div>
            )}

            {/* Nickname (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-slate-600 text-xs font-semibold uppercase tracking-wide">Tên đăng nhập</Label>
              <Input value={user?.nickname || ''} disabled className="bg-slate-100 text-slate-500 cursor-not-allowed" />
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Họ và tên</Label>
              <div className="flex gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nhập họ tên"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSaveName}
                  disabled={accountLoading || editName.trim() === (user?.displayName || '')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4"
                >
                  Lưu
                </Button>
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            {/* Change Password */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-semibold">Đổi mật khẩu</Label>
              <Input
                type="password"
                placeholder="Mật khẩu hiện tại"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
              <Button
                onClick={handleChangePassword}
                disabled={accountLoading || !currentPwd || !newPwd}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white"
              >
                {accountLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
