import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSettings, updateSettings } from '../services/settingsService';
import { getFacilities, getDepartments, saveFacility, deleteFacility, saveDepartment, deleteDepartment } from '../services/departmentService';
import { getAllUsers, updateUser, deleteUser as deleteUserService, resetUserPassword } from '../services/authService';
import { ROLE_LABELS, ROLES, POSITIONS, TITLES } from '../utils/constants';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Settings, Building2, Layers, Users, Plus, Trash2, Edit2, ShieldAlert, KeyRound, Loader2, Save, X, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('general');
  const [settings, setSettingsData] = useState({});
  const [facilities, setFacilities] = useState([]);
  const [departments, setDepts] = useState([]);
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
  }

  useEffect(() => {
    async function load() {
      const [sets, facs, depts, usrs] = await Promise.all([
        getSettings(),
        getFacilities(),
        getDepartments(),
        getAllUsers(),
      ]);
      setSettingsData(sets);
      setFacilities(facs);
      setDepts(depts);
      setUsers(usrs);
    }
    load();
  }, []);

  async function handleSettingsChange(key, value) {
    await updateSettings({ [key]: value });
    setSettingsData((prev) => ({ ...prev, [key]: value }));
    showToast('Đã cập nhật cài đặt');
  }

  // ---- Facility CRUD ----
  const [newFacName, setNewFacName] = useState('');
  async function handleAddFacility() {
    if (!newFacName.trim()) return;
    const id = 'fac_' + Date.now();
    await saveFacility(id, { name: newFacName.trim(), order: facilities.length + 1 });
    setFacilities((prev) => [...prev, { id, name: newFacName.trim(), order: facilities.length + 1 }]);
    setNewFacName('');
    showToast('Đã thêm cơ sở');
  }

  async function handleDeleteFacility(id) {
    if (!window.confirm('Xóa cơ sở này?')) return;
    await deleteFacility(id);
    setFacilities((prev) => prev.filter((f) => f.id !== id));
    showToast('Đã xóa cơ sở');
  }

  // ---- Department CRUD ----
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptFac, setNewDeptFac] = useState('');
  async function handleAddDepartment() {
    if (!newDeptName.trim() || !newDeptFac) return;
    const id = 'dept_' + Date.now();
    const facDepts = departments.filter((d) => d.facilityId === newDeptFac);
    await saveDepartment(id, { name: newDeptName.trim(), facilityId: newDeptFac, order: facDepts.length + 1 });
    setDepts((prev) => [...prev, { id, name: newDeptName.trim(), facilityId: newDeptFac, order: facDepts.length + 1, active: true }]);
    setNewDeptName('');
    showToast('Đã thêm khoa');
  }

  async function handleDeleteDepartment(id) {
    if (!window.confirm('Xóa khoa này?')) return;
    await deleteDepartment(id);
    setDepts((prev) => prev.filter((d) => d.id !== id));
    showToast('Đã xóa khoa');
  }

  // ---- User management ----
  async function handleToggleApproval(uid, current) {
    await updateUser(uid, { approved: !current });
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, approved: !current } : u));
    showToast(!current ? 'Đã phê duyệt' : 'Đã tạm khóa');
  }

  async function handleChangeRole(uid, newRole) {
    await updateUser(uid, { role: newRole });
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, role: newRole } : u));
    showToast('Đã cập nhật vai trò');
  }

  async function handleDeleteUser(uid) {
    if (!window.confirm('Xóa người dùng này?')) return;
    await deleteUserService(uid);
    setUsers((prev) => prev.filter((u) => u.uid !== uid));
    showToast('Đã xóa người dùng');
  }

  async function handleResetPassword(uid) {
    if (!window.confirm('Reset mật khẩu về 123456?')) return;
    try {
      await resetUserPassword(uid);
      showToast('Đã đánh dấu reset. Chạy: node admin-reset-password.mjs');
    } catch (err) {
      showToast(err.message || 'Lỗi khi reset mật khẩu', 'error');
    }
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    try {
      await updateUser(editingUser.uid, {
        displayName: editingUser.displayName,
        role: editingUser.role,
        position: editingUser.position || '',
        title: editingUser.title || '',
        primaryDepartmentId: editingUser.primaryDepartmentId || '',
        additionalDepartments: editingUser.additionalDepartments || []
      });
      setUsers((prev) => prev.map((u) => u.uid === editingUser.uid ? { ...u, ...editingUser } : u));
      setEditingUser(null);
      showToast('Đã cập nhật thông tin người dùng');
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật người dùng', 'error');
    }
  }

  function handleAddAdditionalDept(deptId) {
    if (!deptId) return;
    if (editingUser.additionalDepartments?.includes(deptId)) return;
    setEditingUser((prev) => ({
      ...prev,
      additionalDepartments: [...(prev.additionalDepartments || []), deptId]
    }));
  }

  function handleRemoveAdditionalDept(deptId) {
    setEditingUser((prev) => ({
      ...prev,
      additionalDepartments: (prev.additionalDepartments || []).filter((id) => id !== deptId)
    }));
  }

  const tabs = [
    { key: 'general', label: 'Cấu hình chung', icon: <Settings className="w-4 h-4 mr-2" /> },
    { key: 'facilities', label: 'Cơ sở', icon: <Building2 className="w-4 h-4 mr-2" /> },
    { key: 'departments', label: 'Khoa', icon: <Layers className="w-4 h-4 mr-2" /> },
    { key: 'users', label: 'Người dùng', icon: <Users className="w-4 h-4 mr-2" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 pb-24 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Cài đặt hệ thống
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-6 max-w-6xl w-full mx-auto">
        <Tabs value={tab} onValueChange={setTab} className="w-full flex-col flex h-full">
          <TabsList className="grid w-full lg:w-max grid-cols-2 lg:grid-cols-4 bg-slate-100 p-1 rounded-lg shrink-0 mb-6">
            {tabs.map((t) => (
              <TabsTrigger 
                key={t.key} 
                value={t.key} 
                className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm rounded-md py-2 transition-all font-medium text-slate-600"
              >
                {t.icon}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="general" className="mt-0 focus-visible:outline-none flex-1">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-lg font-semibold text-slate-800">Cấu hình chung</CardTitle>
                <CardDescription>Cài đặt cơ bản cho toàn hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                <div className="space-y-3 max-w-md">
                  <Label htmlFor="hospital-name" className="text-sm font-medium text-slate-700">Tên bệnh viện</Label>
                  <Input
                    id="hospital-name"
                    value={settings.hospitalName || ''}
                    onChange={(e) => setSettingsData((p) => ({ ...p, hospitalName: e.target.value }))}
                    onBlur={(e) => handleSettingsChange('hospitalName', e.target.value)}
                    placeholder="Nhập tên bệnh viện"
                    className="focus-visible:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Tên này sẽ hiển thị trên tiêu đề và báo cáo in ra.</p>
                </div>

                <div className="h-px w-full bg-slate-100 my-6"></div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="space-y-0.5">
                    <Label htmlFor="require-approval" className="text-base font-semibold text-slate-800 cursor-pointer">Yêu cầu phê duyệt tài khoản mới</Label>
                    <p className="text-sm text-slate-500">Tài khoản mới đăng ký phải được Admin duyệt mới có thể đăng nhập.</p>
                  </div>
                  <Switch
                    id="require-approval"
                    checked={settings.requireApproval || false}
                    onCheckedChange={(checked) => handleSettingsChange('requireApproval', checked)}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="facilities" className="mt-0 focus-visible:outline-none flex-1">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 py-4">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800">Quản lý cơ sở</CardTitle>
                  <CardDescription>Tạo và quản lý các cơ sở, chi nhánh</CardDescription>
                </div>
              </CardHeader>
              
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <div className="flex gap-3 max-w-md">
                  <Input
                    placeholder="Tên cơ sở mới..."
                    value={newFacName}
                    onChange={(e) => setNewFacName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFacility()}
                    className="focus-visible:ring-blue-500"
                  />
                  <Button onClick={handleAddFacility} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm cơ sở
                  </Button>
                </div>
              </div>

              <CardContent className="p-0 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Tên cơ sở</th>
                        <th className="px-6 py-4 font-semibold text-center w-32">Số Khoa</th>
                        <th className="px-6 py-4 font-semibold text-right w-32">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {facilities.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-8 text-slate-500 bg-slate-50/50">Chưa có cơ sở nào</td>
                        </tr>
                      ) : (
                        facilities.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4 font-medium text-slate-900">{f.name}</td>
                            <td className="px-6 py-4 text-center text-slate-600">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700">{departments.filter((d) => d.facilityId === f.id).length} khoa</Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteFacility(f.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-4 h-4 mr-2" /> Xóa
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="mt-0 focus-visible:outline-none flex-1">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                <CardTitle className="text-lg font-semibold text-slate-800">Quản lý khoa</CardTitle>
                <CardDescription>Tạo và phân bổ các khoa vào từng cơ sở</CardDescription>
              </CardHeader>
              
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={newDeptFac} onValueChange={setNewDeptFac}>
                    <SelectTrigger className="w-full sm:w-[220px] bg-white">
                      <SelectValue placeholder="Chọn cơ sở trực thuộc..." />
                    </SelectTrigger>
                    <SelectContent>
                      {facilities.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Tên khoa mới..."
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDepartment()}
                    className="flex-1 focus-visible:ring-blue-500 bg-white"
                  />
                  
                  <Button onClick={handleAddDepartment} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm khoa
                  </Button>
                </div>
              </div>

              <CardContent className="p-0 bg-slate-50 border-t border-slate-100">
                <div className="divide-y divide-slate-200/60 p-4 space-y-6">
                  {facilities.map((fac) => {
                    const facDepts = departments.filter((d) => d.facilityId === fac.id);
                    return (
                      <div key={fac.id} className="pt-2 first:pt-0">
                        <div className="flex items-center gap-2 mb-3 px-2">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <h3 className="text-base font-bold text-slate-800">{fac.name}</h3>
                          <Badge variant="outline" className="ml-2 font-normal text-slate-500 bg-white">
                            {facDepts.length} khoa
                          </Badge>
                        </div>
                        
                        <div className="bg-white border text-sm border-slate-200 rounded-lg overflow-hidden shadow-sm">
                          {facDepts.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 bg-slate-50/50">Chưa có khoa nào trong cơ sở này</div>
                          ) : (
                            <ul className="divide-y divide-slate-100">
                              {facDepts.map(d => (
                                <li key={d.id} className="flex items-center justify-between p-3 px-4 hover:bg-slate-50/80 transition-colors group">
                                  <span className="font-medium text-slate-700">{d.name}</span>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteDepartment(d.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {facilities.length === 0 && (
                    <div className="text-center p-8 text-slate-500">
                      Bạn cần thêm cơ sở trước khi tạo khoa.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-0 focus-visible:outline-none flex-1">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                <CardTitle className="text-lg font-semibold text-slate-800">Quản lý người dùng</CardTitle>
                <CardDescription>Phân quyền, duyệt tài khoản và gán khoa cho nhân viên</CardDescription>
              </CardHeader>
              
              <CardContent className="p-0 bg-white overflow-hidden rounded-b-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 font-semibold min-w-[200px]">Tài khoản</th>
                        <th className="px-5 py-3 font-semibold w-40">Vai trò</th>
                        <th className="px-5 py-3 font-semibold min-w-[200px]">Trực thuộc Khoa</th>
                        <th className="px-5 py-3 font-semibold text-center w-32">Trạng thái</th>
                        <th className="px-5 py-3 font-semibold text-right min-w-[150px]">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-500 bg-slate-50/50">
                            Không có dữ liệu người dùng
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors align-top">
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900">{u.displayName}</span>
                                <span className="text-xs text-slate-500 mt-0.5">@{u.nickname}</span>
                                {u.email && <span className="text-xs text-slate-400">{u.email}</span>}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <Select
                                value={u.role}
                                onValueChange={(val) => handleChangeRole(u.uid, val)}
                                disabled={u.uid === user.uid}
                              >
                                <SelectTrigger className="h-8 text-xs font-semibold focus:ring-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-5 py-3">
                              <div className="space-y-1.5">
                                {u.primaryDepartmentId ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium whitespace-normal text-left h-auto py-1">
                                    Mặc định: {departments.find((d) => d.id === u.primaryDepartmentId)?.name || 'Khoa bị xóa'}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">Chưa gán khoa</span>
                                )}
                                
                                {u.additionalDepartments && u.additionalDepartments.length > 0 && (
                                  <div className="flex flex-col gap-1 mt-1">
                                    {u.additionalDepartments.map(depId => {
                                      const dName = departments.find(d => d.id === depId)?.name;
                                      return dName ? (
                                        <Badge key={depId} variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-[11px] whitespace-normal text-left max-w-full">
                                          + {dName}
                                        </Badge>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              {u.approved ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none font-medium">Hoạt động</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shadow-none font-medium">Chờ duyệt</Badge>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                  onClick={() => setEditingUser({ ...u, additionalDepartments: u.additionalDepartments || [] })}
                                  title="Sửa thông tin"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                
                                <Button
                                  variant={u.approved ? "outline" : "default"}
                                  size="icon"
                                  className={`h-8 w-8 ${u.approved ? 'text-slate-600 hover:text-amber-600 hover:bg-amber-50' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'}`}
                                  onClick={() => handleToggleApproval(u.uid, u.approved)}
                                  disabled={u.uid === user.uid}
                                  title={u.approved ? "Tạm khóa tài khoản" : "Phê duyệt tài khoản"}
                                >
                                  {u.approved ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                </Button>

                                {u.uid !== user.uid && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200"
                                      onClick={() => handleResetPassword(u.uid)}
                                      title="Reset mật khẩu (123456)"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleDeleteUser(u.uid)}
                                      title="Xóa người dùng"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 shrink-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Sửa thông tin người dùng</CardTitle>
                <CardDescription className="mt-1">Cập nhật tài khoản <span className="font-semibold text-slate-700">@{editingUser.nickname}</span></CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingUser(null)} className="h-8 w-8 rounded-full text-slate-500">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="p-6 overflow-y-auto" style={{ flex: '1 1 auto' }}>
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Họ và tên</Label>
                  <Input 
                    value={editingUser.displayName} 
                    onChange={e => setEditingUser(prev => ({ ...prev, displayName: e.target.value }))} 
                    className="focus-visible:ring-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Chức vụ (Hành chính)</Label>
                    <Select 
                      value={editingUser.position || "none"} 
                      onValueChange={val => setEditingUser(prev => ({ ...prev, position: val === "none" ? "" : val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn chức vụ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="italic text-slate-500">-- Không --</SelectItem>
                        {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Chức danh (Chuyên môn)</Label>
                    <Select 
                      value={editingUser.title || "none"} 
                      onValueChange={val => setEditingUser(prev => ({ ...prev, title: val === "none" ? "" : val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn chức danh" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="italic text-slate-500">-- Không --</SelectItem>
                        {TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="h-px bg-slate-100 my-2"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Phân quyền Hệ thống</Label>
                    <Select 
                      value={editingUser.role} 
                      onValueChange={val => setEditingUser(prev => ({ ...prev, role: val }))}
                    >
                      <SelectTrigger className="border-blue-200 bg-blue-50 text-blue-900 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="font-medium">{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Khoa mặc định</Label>
                    <Select 
                      value={editingUser.primaryDepartmentId || "none"} 
                      onValueChange={val => setEditingUser(prev => ({ ...prev, primaryDepartmentId: val === "none" ? "" : val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn khoa chính" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="italic text-slate-500">-- Không có khoa mặc định --</SelectItem>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200">
                  <Label className="text-sm font-medium text-slate-700 mb-2.5 block">Khoa kiêm nhiệm (Nhập & Xem dữ liệu)</Label>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <select 
                        id="add-dept-select" 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        defaultValue=""
                      >
                        <option value="" disabled>-- Chọn khoa kiêm nhiệm --</option>
                        {departments.filter(d => d.id !== editingUser.primaryDepartmentId && !editingUser.additionalDepartments?.includes(d.id)).map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <Button 
                      variant="secondary"
                      onClick={() => {
                        const sel = document.getElementById('add-dept-select');
                        if (sel.value) {
                          handleAddAdditionalDept(sel.value);
                          sel.value = "";
                        }
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Thêm
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editingUser.additionalDepartments?.map(deptId => {
                      const dName = departments.find(d => d.id === deptId)?.name || deptId;
                      return (
                        <Badge key={deptId} variant="secondary" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-100 pr-1 pl-3 py-1 text-sm font-normal">
                          {dName}
                          <button 
                            type="button" 
                            className="ml-1.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-red-500 transition-colors"
                            onClick={() => handleRemoveAdditionalDept(deptId)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </Badge>
                      )
                    })}
                    {(!editingUser.additionalDepartments || editingUser.additionalDepartments.length === 0) && (
                      <span className="text-sm text-slate-500 italic mt-1">Chưa gán khoa kiêm nhiệm nào</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0 rounded-b-xl">
              <Button variant="outline" onClick={() => setEditingUser(null)}>Hủy bỏ</Button>
              <Button onClick={handleSaveUser} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Save className="w-4 h-4 mr-2" />
                Lưu lại
              </Button>
            </div>
          </Card>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center justify-between gap-4 px-4 py-3 rounded-lg shadow-lg bg-slate-800 text-white animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 font-medium">
            <Settings className={`w-5 h-5 ${toast.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`} />
            <span>{toast.msg}</span>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-300 hover:text-white transition-colors p-1"
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}
