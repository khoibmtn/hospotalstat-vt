import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSettings, updateSettings } from '../services/settingsService';
import { getFacilities, getDepartments, saveFacility, deleteFacility, saveDepartment, deleteDepartment } from '../services/departmentService';
import { getDiseaseCatalog, addDisease, updateDiseaseName, updateDiseaseColor, updateDiseaseGroup, swapDiseaseOrder, deleteDisease, isDiseaseUsedInReports } from '../services/diseaseCatalogService';
import { getAllUsers, updateUser, deleteUser as deleteUserService, resetUserPassword } from '../services/authService';
import { importReports } from '../services/reportService';
import { ROLE_LABELS, ROLES, POSITIONS, TITLES } from '../utils/constants';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Settings, Building2, Layers, Users, Plus, Trash2, Edit2, ShieldAlert, KeyRound, Loader2, Save, X, ShieldCheck, Upload, ListChecks, Check, Lock, Unlock, Palette, ArrowUp, ArrowDown, Asterisk, ArrowRightLeft } from 'lucide-react';
import ImportDataModal from '../components/data-entry/ImportDataModal';

import { seedDiseaseCatalog, syncDiseaseCatalog } from '../utils/seedDiseases';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('general');
  const [settings, setSettingsData] = useState({});
  const [facilities, setFacilities] = useState([]);
  const [departments, setDepts] = useState([]);
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Disease catalog state
  const [diseases, setDiseases] = useState([]);
  const [newDiseaseName, setNewDiseaseName] = useState('');
  const [editingDiseaseId, setEditingDiseaseId] = useState(null);
  const [editingDiseaseName, setEditingDiseaseName] = useState('');
  const [diseaseUsageCache, setDiseaseUsageCache] = useState({});
  const [newDiseaseColor, setNewDiseaseColor] = useState('#ef4444');
  const [newDiseaseGroup, setNewDiseaseGroup] = useState('B');
  const [colorPickerOpen, setColorPickerOpen] = useState(null);
  const [newDiseaseColorOpen, setNewDiseaseColorOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Death Report Columns state
  const DEFAULT_DEATH_REPORT_COLUMNS = [
    { id: 'maKCB', label: 'Mã KCB', type: 'text', isFixed: true, isCore: true },
    { id: 'hoTen', label: 'Họ tên', type: 'text', isFixed: true, isCore: true },
    { id: 'namSinh', label: 'Năm sinh', type: 'text', isFixed: false, isCore: true },
    { id: 'timeVaoVien', label: 'Ngày giờ vào viện', type: 'datetime', isFixed: false, isCore: true },
    { id: 'timeTuVong', label: 'Ngày giờ tử vong', type: 'datetime', isFixed: false, isCore: true },
    { id: 'chanDoanVao', label: 'CĐ vào viện', type: 'text', isFixed: false, isCore: true },
    { id: 'chanDoanTuVong', label: 'CĐ tử vong', type: 'text', isFixed: false, isCore: true },
    { id: 'dienBien', label: 'Diễn biến lâm sàng', type: 'text', isFixed: false, isCore: false },
    { id: 'tomTatCLS', label: 'Tóm tắt CLS', type: 'text', isFixed: false, isCore: false },
    { id: 'ghiChu', label: 'Ghi chú', type: 'text', isFixed: false, isCore: false },
  ];
  const [deathColumns, setDeathColumns] = useState([]);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [editingColId, setEditingColId] = useState(null);
  const [editingColLabel, setEditingColLabel] = useState('');
  const [confirmDeleteColId, setConfirmDeleteColId] = useState(null);

  const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
    '#ec4899', '#f43f5e', '#78716c', '#6b7280',
  ];

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
      setDeathColumns(sets.deathReportColumns || DEFAULT_DEATH_REPORT_COLUMNS);
      setFacilities(facs);
      setDepts(depts);
      setUsers(usrs);
      
      // Seed then fetch disease catalog
      try {
        await seedDiseaseCatalog();
        const diseaseCat = await getDiseaseCatalog();
        setDiseases(diseaseCat);
      } catch (e) {
        console.warn('Disease catalog not yet available:', e.message);
        setDiseases([]);
      }
    }
    load();
  }, []);

  async function handleSettingsChange(key, value) {
    await updateSettings({ [key]: value });
    setSettingsData((prev) => ({ ...prev, [key]: value }));
    showToast('Đã cập nhật cài đặt');
  }

  async function handleSaveDeathColumns(newCols) {
    setDeathColumns(newCols);
    await handleSettingsChange('deathReportColumns', newCols);
  }

  function handleAddDeathCol() {
    if (!newColLabel.trim()) return;
    const newCol = {
      id: 'custom_' + Date.now(),
      label: newColLabel.trim(),
      type: newColType,
      isFixed: false,
      isCore: false
    };
    const newCols = [...deathColumns, newCol];
    handleSaveDeathColumns(newCols);
    setNewColLabel('');
    setNewColType('text');
  }

  function handleDeleteDeathCol(id) {
    const newCols = deathColumns.filter((c) => c.id !== id);
    handleSaveDeathColumns(newCols);
    setConfirmDeleteColId(null);
  }

  function handleMoveDeathCol(index, direction) {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === deathColumns.length - 1) return;
    const newCols = [...deathColumns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newCols[index], newCols[targetIndex]] = [newCols[targetIndex], newCols[index]];
    handleSaveDeathColumns(newCols);
  }

  function handleSaveEditDeathCol(id) {
    if (!editingColLabel.trim()) {
      setEditingColId(null);
      return;
    }
    const newCols = deathColumns.map((c) => c.id === id ? { ...c, label: editingColLabel.trim() } : c);
    handleSaveDeathColumns(newCols);
    setEditingColId(null);
  }

  function handleToggleRequired(id) {
    const newCols = deathColumns.map((c) => c.id === id ? { ...c, isCore: !c.isCore } : c);
    handleSaveDeathColumns(newCols);
  }

  function handleToggleFixed(id) {
    const newCols = deathColumns.map((c) => c.id === id ? { ...c, isFixed: !c.isFixed } : c);
    handleSaveDeathColumns(newCols);
  }

  // ---- Facility CRUD ----
  const [newFacName, setNewFacName] = useState('');
  const [editingFac, setEditingFac] = useState(null);
  const [editingFacName, setEditingFacName] = useState('');

  async function handleAddFacility() {
    if (!newFacName.trim()) return;
    const id = 'fac_' + Date.now();
    await saveFacility(id, { name: newFacName.trim(), order: facilities.length + 1, active: true });
    setFacilities((prev) => [...prev, { id, name: newFacName.trim(), order: facilities.length + 1, active: true }]);
    setNewFacName('');
    showToast('Đã thêm cơ sở');
  }

  async function handleDeleteFacility(id) {
    if (!window.confirm('Xóa cơ sở này?')) return;
    await deleteFacility(id);
    setFacilities((prev) => prev.filter((f) => f.id !== id));
    showToast('Đã xóa cơ sở');
  }

  function handleStartEditFac(fac) {
    setEditingFac(fac.id);
    setEditingFacName(fac.name);
  }

  async function handleSaveEditFac(fac) {
    if (!editingFacName.trim()) { setEditingFac(null); return; }
    await saveFacility(fac.id, { ...fac, name: editingFacName.trim() });
    setFacilities((prev) => prev.map((f) => f.id === fac.id ? { ...f, name: editingFacName.trim() } : f));
    setEditingFac(null);
    showToast('Đã cập nhật tên cơ sở');
  }

  async function handleToggleFacLock(fac) {
    const newActive = fac.active === false ? true : false;
    await saveFacility(fac.id, { ...fac, active: newActive });
    setFacilities((prev) => prev.map((f) => f.id === fac.id ? { ...f, active: newActive } : f));

    // Cascade to all departments under this facility
    const childDepts = departments.filter((d) => d.facilityId === fac.id);
    for (const dept of childDepts) {
      await saveDepartment(dept.id, { ...dept, active: newActive });
    }
    setDepts((prev) => prev.map((d) => d.facilityId === fac.id ? { ...d, active: newActive } : d));

    showToast(newActive ? 'Đã mở khóa cơ sở và tất cả khoa trực thuộc' : 'Đã khóa cơ sở và tất cả khoa trực thuộc');
  }

  // ---- Department CRUD ----
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptFac, setNewDeptFac] = useState('');
  const [editingDept, setEditingDept] = useState(null);
  const [editingDeptName, setEditingDeptName] = useState('');
  const [transferringDept, setTransferringDept] = useState(null);

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

  function handleStartEditDept(dept) {
    setEditingDept(dept.id);
    setEditingDeptName(dept.name);
  }

  async function handleSaveEditDept(dept) {
    if (!editingDeptName.trim()) { setEditingDept(null); return; }
    await saveDepartment(dept.id, { ...dept, name: editingDeptName.trim() });
    setDepts((prev) => prev.map((d) => d.id === dept.id ? { ...d, name: editingDeptName.trim() } : d));
    setEditingDept(null);
    showToast('Đã cập nhật tên khoa');
  }

  async function handleToggleDeptLock(dept) {
    // Block unlocking if parent facility is locked
    if (dept.active === false) {
      const parentFac = facilities.find((f) => f.id === dept.facilityId);
      if (parentFac && parentFac.active === false) {
        showToast('Không thể mở khóa khoa khi cơ sở "' + parentFac.name + '" đang bị khóa. Hãy mở khóa cơ sở trước.', 'error');
        return;
      }
    }
    const newActive = dept.active === false ? true : false;
    await saveDepartment(dept.id, { ...dept, active: newActive });
    setDepts((prev) => prev.map((d) => d.id === dept.id ? { ...d, active: newActive } : d));
    showToast(newActive ? 'Đã mở khóa khoa' : 'Đã khóa khoa');
  }

  async function handleTransferDept(dept, newFacilityId) {
    if (!newFacilityId || newFacilityId === dept.facilityId) { setTransferringDept(null); return; }
    const targetFac = facilities.find(f => f.id === newFacilityId);
    if (!window.confirm(`Chuyển khoa "${dept.name}" sang ${targetFac?.name || newFacilityId}?`)) {
      setTransferringDept(null);
      return;
    }
    const targetDepts = departments.filter(d => d.facilityId === newFacilityId);
    await saveDepartment(dept.id, { ...dept, facilityId: newFacilityId, order: targetDepts.length + 1 });
    setDepts(prev => prev.map(d => d.id === dept.id ? { ...d, facilityId: newFacilityId, order: targetDepts.length + 1 } : d));
    setTransferringDept(null);
    showToast(`Đã chuyển khoa "${dept.name}" sang ${targetFac?.name}`);
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

  // ---- Disease Catalog CRUD ----
  async function handleAddDisease() {
    if (!newDiseaseName.trim()) return;
    const id = await addDisease(newDiseaseName, newDiseaseColor, newDiseaseGroup);
    setDiseases((prev) => [...prev, { id, name: newDiseaseName.trim(), order: prev.length + 1, color: newDiseaseColor, group: newDiseaseGroup }]);
    setNewDiseaseName('');
    setNewDiseaseColor('#ef4444');
    setNewDiseaseGroup('B');
    showToast('Đã thêm bệnh truyền nhiễm');
  }

  async function handleSyncCatalog() {
    setSyncing(true);
    try {
      const result = await syncDiseaseCatalog();
      const catalog = await getDiseaseCatalog();
      setDiseases(catalog);
      showToast(`Đồng bộ xong: ${result.added} bệnh mới, ${result.updated} đã cập nhật`);
    } catch (e) {
      showToast('Lỗi đồng bộ: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteDisease(disease) {
    const used = await isDiseaseUsedInReports(disease.name);
    if (used) {
      showToast('Bệnh "' + disease.name + '" đang được sử dụng trong báo cáo, không thể xóa.', 'error');
      return;
    }
    if (!window.confirm('Xóa bệnh "' + disease.name + '" khỏi danh mục?')) return;
    await deleteDisease(disease.id);
    setDiseases((prev) => prev.filter((d) => d.id !== disease.id));
    showToast('Đã xóa khỏi danh mục');
  }

  function handleStartEditDisease(disease) {
    setEditingDiseaseId(disease.id);
    setEditingDiseaseName(disease.name);
  }

  async function handleSaveEditDisease(disease) {
    if (!editingDiseaseName.trim()) { setEditingDiseaseId(null); return; }
    await updateDiseaseName(disease.id, editingDiseaseName);
    setDiseases((prev) => prev.map((d) => d.id === disease.id ? { ...d, name: editingDiseaseName.trim() } : d));
    setEditingDiseaseId(null);
    showToast('Đã cập nhật tên bệnh');
  }

  // Check usage for all diseases (called when switching to catalog tab)
  async function refreshDiseaseUsage() {
    const cache = {};
    for (const d of diseases) {
      cache[d.id] = await isDiseaseUsedInReports(d.name);
    }
    setDiseaseUsageCache(cache);
  }

  const tabs = [
    { key: 'general', label: 'Cấu hình chung', icon: <Settings className="w-4 h-4 mr-2" /> },
    { key: 'facilities', label: 'Cơ sở', icon: <Building2 className="w-4 h-4 mr-2" /> },
    { key: 'departments', label: 'Khoa', icon: <Layers className="w-4 h-4 mr-2" /> },
    { key: 'users', label: 'Người dùng', icon: <Users className="w-4 h-4 mr-2" /> },
    { key: 'catalog', label: 'Danh mục', icon: <ListChecks className="w-4 h-4 mr-2" /> },
  ];

  const handleImportConfirm = async (deptId, records) => {
    try {
      const dept = departments.find(d => d.id === deptId);
      if (!dept) throw new Error("Khoa không hợp lệ");
      
      const count = await importReports(deptId, dept.name, dept.facilityId, records, user);
      showToast(`Đã import thành công ${count} dòng.`, 'success');
      setIsImportModalOpen(false);
    } catch (err) {
      console.error(err);
      throw err; // let Modal catch and show error
    }
  };

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
          <TabsList className="grid w-full lg:w-max grid-cols-2 lg:grid-cols-5 bg-slate-100 p-1 rounded-lg shrink-0 mb-6">
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

                {user.role === ROLES.ADMIN && (
                  <>
                    <div className="h-px w-full bg-slate-100 my-6"></div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="space-y-0.5">
                        <Label className="text-base font-semibold text-slate-800">Import số liệu từ Excel</Label>
                        <p className="text-sm text-slate-500">Tải số liệu báo cáo hàng ngày từ file Excel mẫu vào hệ thống.</p>
                      </div>
                      <Button 
                        variant="outline"
                        onClick={() => setIsImportModalOpen(true)}
                        className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-white"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Import Excel
                      </Button>
                    </div>
                  </>
                )}
                
                {/* --- Death Report Columns Config --- */}
                <div className="h-px w-full bg-slate-100 my-6"></div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Danh mục cột báo cáo bệnh nhân tử vong</h3>
                    <p className="text-sm text-slate-500">Cấu hình các trường dữ liệu cần nhập khi có ca tử vong. Cột hệ thống cố định không thể xóa.</p>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100/50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold w-16 text-center">STT</th>
                          <th className="px-4 py-3 font-semibold">Tên cột (Label)</th>
                          <th className="px-4 py-3 font-semibold w-32">Kiểu dữ liệu</th>
                          <th className="px-4 py-3 font-semibold w-24 text-center">Loại cột</th>
                          <th className="px-4 py-3 font-semibold w-24 text-center">Bắt buộc</th>
                          <th className="px-4 py-3 font-semibold w-32 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {deathColumns.map((col, index) => (
                          <tr key={col.id} className="hover:bg-slate-50/50 group">
                            <td className="px-4 py-3 text-center text-slate-500 font-medium">{index + 1}</td>
                            <td className="px-4 py-3">
                              {editingColId === col.id ? (
                                <div className="flex items-center gap-2 max-w-sm">
                                  <Input
                                    value={editingColLabel}
                                    onChange={(e) => setEditingColLabel(e.target.value)}
                                    onKeyDown={(e) => { 
                                      if (e.key === 'Enter') handleSaveEditDeathCol(col.id); 
                                      if (e.key === 'Escape') setEditingColId(null); 
                                    }}
                                    autoFocus
                                    className="h-8 text-sm focus-visible:ring-blue-500"
                                  />
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 shrink-0" onClick={() => handleSaveEditDeathCol(col.id)}>
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100 shrink-0" onClick={() => setEditingColId(null)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="font-medium text-slate-900">{col.label}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                                {col.type === 'text' ? 'Văn bản' : 'Ngày giờ'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleFixed(col.id)}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer ${col.isFixed ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}
                                title={col.isFixed ? 'Cố định — click để chuyển tùy chỉnh' : 'Tùy chỉnh — click để chuyển cố định'}
                              >
                                {col.isFixed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleRequired(col.id)}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${col.isCore ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                title={col.isCore ? 'Bắt buộc nhập — click để bỏ' : 'Không bắt buộc — click để đặt bắt buộc'}
                              >
                                <Asterisk className="w-4 h-4" />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100" onClick={() => handleMoveDeathCol(index, 'up')} disabled={index === 0}>
                                  <ArrowUp className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100" onClick={() => handleMoveDeathCol(index, 'down')} disabled={index === deathColumns.length - 1}>
                                  <ArrowDown className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-shrink-0" onClick={() => { setEditingColId(col.id); setEditingColLabel(col.label); }}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                {!col.isFixed && (
                                  confirmDeleteColId === col.id ? (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-700 hover:text-white hover:bg-red-600 flex-shrink-0" title="Xác nhận xóa" onClick={() => handleDeleteDeathCol(col.id)}>
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex-shrink-0" title="Hủy" onClick={() => setConfirmDeleteColId(null)}>
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0" onClick={() => setConfirmDeleteColId(col.id)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2 max-w-2xl">
                    <Input
                      placeholder="Tên cột tùy chỉnh mới..."
                      value={newColLabel}
                      onChange={(e) => setNewColLabel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddDeathCol()}
                      className="flex-1 focus-visible:ring-blue-500"
                    />
                    <Select value={newColType} onValueChange={setNewColType}>
                      <SelectTrigger className="w-full sm:w-[150px] bg-white">
                        <SelectValue placeholder="Kiểu dữ liệu" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Văn bản</SelectItem>
                        <SelectItem value="datetime">Ngày giờ</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddDeathCol} className="bg-slate-800 hover:bg-slate-900 text-white shrink-0 sm:w-auto w-full group">
                      <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                      Thêm cột
                    </Button>
                  </div>
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
                        <th className="px-6 py-4 font-semibold text-center w-32">Trạng thái</th>
                        <th className="px-6 py-4 font-semibold text-right w-48">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {facilities.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-slate-500 bg-slate-50/50">Chưa có cơ sở nào</td>
                        </tr>
                      ) : (
                        facilities.map((f) => (
                          <tr key={f.id} className={`group border-b border-slate-200 hover:bg-slate-100 transition-colors ${f.active === false ? 'bg-slate-100 opacity-60' : 'bg-white even:bg-slate-50'}`}>
                            <td className="px-6 py-4">
                              {editingFac === f.id ? (
                                <div className="flex items-center gap-2 max-w-sm">
                                  <Input
                                    value={editingFacName}
                                    onChange={(e) => setEditingFacName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditFac(f); if (e.key === 'Escape') setEditingFac(null); }}
                                    autoFocus
                                    className="h-8 text-sm focus-visible:ring-blue-500"
                                  />
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => handleSaveEditFac(f)}>
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100" onClick={() => setEditingFac(null)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="font-medium text-slate-900">{f.name}</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center text-slate-600">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700">{departments.filter((d) => d.facilityId === f.id).length} khoa</Badge>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {f.active === false ? (
                                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200"><Lock className="w-3 h-3 mr-1" /> Đã khóa</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><Unlock className="w-3 h-3 mr-1" /> Hoạt động</Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleStartEditFac(f)} className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2">
                                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Sửa
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleToggleFacLock(f)} className={`opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2 ${f.active === false ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}>
                                  {f.active === false ? <><Unlock className="w-3.5 h-3.5 mr-1" /> Mở khóa</> : <><Lock className="w-3.5 h-3.5 mr-1" /> Khóa</>}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteFacility(f.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2">
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Xóa
                                </Button>
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
                                <li key={d.id} className={`flex items-center justify-between p-3 px-4 hover:bg-slate-50/80 transition-colors group ${d.active === false ? 'opacity-50 bg-slate-50' : ''}`}>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {editingDept === d.id ? (
                                      <div className="flex items-center gap-2 flex-1">
                                        <Input
                                          value={editingDeptName}
                                          onChange={(e) => setEditingDeptName(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditDept(d); if (e.key === 'Escape') setEditingDept(null); }}
                                          autoFocus
                                          className="h-8 text-sm focus-visible:ring-blue-500 max-w-xs"
                                        />
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 shrink-0" onClick={() => handleSaveEditDept(d)}>
                                          <Check className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:bg-slate-100 shrink-0" onClick={() => setEditingDept(null)}>
                                          <X className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="font-medium text-slate-700">{d.name}</span>
                                        {d.active === false && (
                                          <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs ml-2"><Lock className="w-3 h-3 mr-0.5" /> Khóa</Badge>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {transferringDept === d.id ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-slate-500 whitespace-nowrap">→</span>
                                        <Select onValueChange={(val) => handleTransferDept(d, val)}>
                                          <SelectTrigger className="h-7 w-[140px] text-xs">
                                            <SelectValue placeholder="Chọn cơ sở..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {facilities.filter(f => f.id !== d.facilityId).map(f => (
                                              <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:bg-slate-100" onClick={() => setTransferringDept(null)}>
                                          <X className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
                                        <Button variant="ghost" size="sm" onClick={() => handleStartEditDept(d)} className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 h-7 px-1.5">
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setTransferringDept(d.id)} className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 h-7 px-1.5" title="Chuyển cơ sở">
                                          <ArrowRightLeft className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleToggleDeptLock(d)} className={`h-7 px-1.5 ${d.active === false ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}>
                                          {d.active === false ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDepartment(d.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-1.5">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
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
                          <tr key={u.uid} className="group bg-white even:bg-slate-50 border-b border-slate-200 hover:bg-slate-200 focus-within:bg-blue-100 transition-colors align-top">
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

          <TabsContent value="catalog" className="mt-0 focus-visible:outline-none flex-1">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 py-4">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800">Danh mục Bệnh truyền nhiễm</CardTitle>
                  <CardDescription>Quản lý danh sách bệnh truyền nhiễm dùng trong nhập liệu hàng ngày</CardDescription>
                </div>
                <Button onClick={handleSyncCatalog} disabled={syncing} variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ListChecks className="w-4 h-4 mr-2" />}
                  Đồng bộ danh mục BYT
                </Button>
              </CardHeader>

              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <div className="flex gap-3 items-center flex-wrap">
                  <Input
                    placeholder="Tên bệnh truyền nhiễm mới..."
                    value={newDiseaseName}
                    onChange={(e) => setNewDiseaseName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDisease()}
                    className="focus-visible:ring-blue-500 max-w-xs"
                  />
                  <Select value={newDiseaseGroup} onValueChange={setNewDiseaseGroup}>
                    <SelectTrigger className="w-[110px] h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A"><span className="font-semibold text-red-600">Nhóm A</span></SelectItem>
                      <SelectItem value="B"><span className="font-semibold text-blue-600">Nhóm B</span></SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setNewDiseaseColorOpen(!newDiseaseColorOpen)}
                      className="w-8 h-8 rounded-md border-2 border-slate-300 shadow-inner hover:ring-2 hover:ring-blue-300 transition-all"
                      style={{ backgroundColor: newDiseaseColor }}
                      title="Chọn màu"
                    />
                    {newDiseaseColorOpen && (
                      <div className="absolute top-10 left-0 z-50 bg-white rounded-lg shadow-xl border border-slate-200 p-2 w-[152px]">
                        <div className="grid grid-cols-4 gap-1.5">
                          {PRESET_COLORS.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => { setNewDiseaseColor(c); setNewDiseaseColorOpen(false); }}
                              className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${newDiseaseColor === c ? 'border-slate-800 ring-2 ring-offset-1 ring-blue-400' : 'border-slate-200'}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button onClick={handleAddDisease} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm bệnh
                  </Button>
                </div>
              </div>

              <CardContent className="p-0 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-4 font-semibold w-10 text-center">STT</th>
                        <th className="px-2 py-4 font-semibold w-16 text-center">Thứ tự</th>
                        <th className="px-6 py-4 font-semibold">Tên bệnh</th>
                        <th className="px-4 py-4 font-semibold text-center w-28">Nhóm</th>
                        <th className="px-4 py-4 font-semibold text-center w-24">Màu</th>
                        <th className="px-6 py-4 font-semibold text-center w-40">Trạng thái</th>
                        <th className="px-6 py-4 font-semibold text-right w-40">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {diseases.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500 bg-slate-50/50">Chưa có bệnh nào trong danh mục</td>
                        </tr>
                      ) : (
                        diseases.map((d, idx) => (
                          <tr key={d.id} className="group bg-white even:bg-slate-50 border-b border-slate-200 hover:bg-slate-200 transition-colors">
                            <td className="px-3 py-3 text-slate-500 font-mono text-xs text-center">{idx + 1}</td>
                            <td className="px-2 py-3 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-6 w-6 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30"
                                  disabled={idx === 0}
                                  onClick={async () => {
                                    const prev = diseases[idx - 1];
                                    await swapDiseaseOrder(d.id, d.order, prev.id, prev.order);
                                    setDiseases(old => {
                                      const arr = [...old];
                                      [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
                                      return arr.map((item, i) => ({ ...item, order: i + 1 }));
                                    });
                                  }}
                                  title="Di chuyển lên"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-6 w-6 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30"
                                  disabled={idx === diseases.length - 1}
                                  onClick={async () => {
                                    const next = diseases[idx + 1];
                                    await swapDiseaseOrder(d.id, d.order, next.id, next.order);
                                    setDiseases(old => {
                                      const arr = [...old];
                                      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                                      return arr.map((item, i) => ({ ...item, order: i + 1 }));
                                    });
                                  }}
                                  title="Di chuyển xuống"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              {editingDiseaseId === d.id ? (
                                <div className="flex items-center gap-2 max-w-sm">
                                  <Input
                                    value={editingDiseaseName}
                                    onChange={(e) => setEditingDiseaseName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditDisease(d); if (e.key === 'Escape') setEditingDiseaseId(null); }}
                                    autoFocus
                                    className="h-8 text-sm focus-visible:ring-blue-500"
                                  />
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => handleSaveEditDisease(d)}>
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100" onClick={() => setEditingDiseaseId(null)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="font-medium text-slate-900 cursor-pointer hover:text-blue-600" onDoubleClick={() => handleStartEditDisease(d)}>{d.name}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Select
                                value={d.group || 'B'}
                                onValueChange={async (val) => {
                                  await updateDiseaseGroup(d.id, val);
                                  setDiseases(prev => prev.map(di => di.id === d.id ? { ...di, group: val } : di));
                                }}
                              >
                                <SelectTrigger className={`w-[90px] h-8 text-xs mx-auto font-semibold ${(d.group || 'B') === 'A' ? 'border-red-300 text-red-700 bg-red-50' : 'border-blue-300 text-blue-700 bg-blue-50'}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="A"><span className="font-semibold text-red-600">Nhóm A</span></SelectItem>
                                  <SelectItem value="B"><span className="font-semibold text-blue-600">Nhóm B</span></SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() => setColorPickerOpen(colorPickerOpen === d.id ? null : d.id)}
                                  className="w-7 h-7 rounded-md border-2 border-slate-300 shadow-inner mx-auto hover:ring-2 hover:ring-blue-300 transition-all"
                                  style={{ backgroundColor: d.color || '#6b7280' }}
                                  title="Bấm để đổi màu"
                                />
                                {colorPickerOpen === d.id && (
                                  <div className="absolute top-9 left-1/2 -translate-x-1/2 z-50 bg-white rounded-lg shadow-xl border border-slate-200 p-2 w-[152px]">
                                    <div className="grid grid-cols-4 gap-1.5">
                                      {PRESET_COLORS.map(c => (
                                        <button
                                          key={c}
                                          type="button"
                                          onClick={async () => {
                                            await updateDiseaseColor(d.id, c);
                                            setDiseases((prev) => prev.map((di) => di.id === d.id ? { ...di, color: c } : di));
                                            setColorPickerOpen(null);
                                          }}
                                          className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${(d.color || '#6b7280') === c ? 'border-slate-800 ring-2 ring-offset-1 ring-blue-400' : 'border-slate-200'}`}
                                          style={{ backgroundColor: c }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-3 text-center">
                              {diseaseUsageCache[d.id] ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">Đang sử dụng</Badge>
                              ) : diseaseUsageCache[d.id] === false ? (
                                <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 font-normal">Chưa sử dụng</Badge>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button variant="ghost" size="sm" onClick={() => handleStartEditDisease(d)} className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2">
                                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Sửa
                                </Button>
                                {!diseaseUsageCache[d.id] && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteDisease(d)} className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2">
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Xóa
                                </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {diseases.length > 0 && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <Button variant="outline" size="sm" onClick={refreshDiseaseUsage} className="text-slate-600">
                      <Loader2 className="w-3.5 h-3.5 mr-1.5" /> Kiểm tra trạng thái sử dụng
                    </Button>
                  </div>
                )}
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

      {/* Import Modal */}
      <ImportDataModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        departments={departments}
        onImportConfirm={handleImportConfirm}
      />
    </div>
  );
}
