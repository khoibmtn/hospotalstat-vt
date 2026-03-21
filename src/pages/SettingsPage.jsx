import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSettings, updateSettings } from '../services/settingsService';
import { getFacilities, getDepartments, saveFacility, deleteFacility, saveDepartment, deleteDepartment } from '../services/departmentService';
import { getAllUsers, updateUser, deleteUser as deleteUserService, resetUserPassword } from '../services/authService';
import { ROLE_LABELS, ROLES, POSITIONS, TITLES } from '../utils/constants';

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
    { key: 'general', label: '⚙️ Cấu hình chung' },
    { key: 'facilities', label: '🏢 Cơ sở' },
    { key: 'departments', label: '🏥 Khoa' },
    { key: 'users', label: '👥 Người dùng' },
  ];

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <h1 className="app-header__title">⚙️ Cài đặt</h1>
        </div>
      </header>

      <div className="app-content">
        <div className="settings-grid">
          {/* Nav */}
          <nav className="settings-nav">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`settings-nav__item ${tab === t.key ? 'settings-nav__item--active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div>
            {tab === 'general' && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Cấu hình chung</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  <div className="form-group">
                    <label className="form-label">Tên bệnh viện</label>
                    <input
                      className="form-input"
                      value={settings.hospitalName || ''}
                      onChange={(e) => setSettingsData((p) => ({ ...p, hospitalName: e.target.value }))}
                      onBlur={(e) => handleSettingsChange('hospitalName', e.target.value)}
                      placeholder="Nhập tên bệnh viện"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.requireApproval || false}
                        onChange={(e) => handleSettingsChange('requireApproval', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-500)' }}
                      />
                      <span style={{ fontWeight: 500 }}>Yêu cầu phê duyệt thành viên mới</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {tab === 'facilities' && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Quản lý cơ sở</h2>
                </div>

                <table className="data-table" style={{ marginBottom: 'var(--space-4)' }}>
                  <thead>
                    <tr>
                      <th>Tên cơ sở</th>
                      <th>Số khoa</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facilities.map((f) => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 500 }}>{f.name}</td>
                        <td>{departments.filter((d) => d.facilityId === f.id).length}</td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFacility(f.id)}>
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input
                    className="form-input"
                    placeholder="Tên cơ sở mới"
                    value={newFacName}
                    onChange={(e) => setNewFacName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFacility()}
                  />
                  <button className="btn btn-primary" onClick={handleAddFacility}>Thêm</button>
                </div>
              </div>
            )}

            {tab === 'departments' && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Quản lý khoa</h2>
                </div>

                {facilities.map((fac) => (
                  <div key={fac.id} style={{ marginBottom: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-primary-600)' }}>
                      {fac.name}
                    </h3>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tên khoa</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departments
                          .filter((d) => d.facilityId === fac.id)
                          .map((d) => (
                            <tr key={d.id}>
                              <td style={{ fontWeight: 500 }}>{d.name}</td>
                              <td>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDepartment(d.id)}>
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                  <select
                    className="form-input"
                    value={newDeptFac}
                    onChange={(e) => setNewDeptFac(e.target.value)}
                    style={{ width: '140px' }}
                  >
                    <option value="">Chọn cơ sở</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    placeholder="Tên khoa mới"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDepartment()}
                  />
                  <button className="btn btn-primary" onClick={handleAddDepartment}>Thêm</button>
                </div>
              </div>
            )}

            {tab === 'users' && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Quản lý người dùng</h2>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Người dùng</th>
                      <th>Vai trò</th>
                      <th>Khoa</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.uid}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{u.displayName}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)' }}>@{u.nickname}</div>
                        </td>
                        <td>
                          <select
                            className="form-input"
                            value={u.role}
                            onChange={(e) => handleChangeRole(u.uid, e.target.value)}
                            style={{ width: '160px', height: '28px', fontSize: '0.8125rem' }}
                            disabled={u.uid === user.uid}
                          >
                            {Object.entries(ROLE_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {u.primaryDepartmentId && (
                            <div style={{ fontWeight: 500 }}>
                              {departments.find((d) => d.id === u.primaryDepartmentId)?.name || '—'}
                            </div>
                          )}
                          {u.additionalDepartments && u.additionalDepartments.length > 0 && (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)', marginTop: '2px' }}>
                              + {u.additionalDepartments.map(depId => departments.find(d => d.id === depId)?.name).filter(Boolean).join(', ')}
                            </div>
                          )}
                          {!u.primaryDepartmentId && (!u.additionalDepartments || u.additionalDepartments.length === 0) && '—'}
                        </td>
                        <td>
                          <span className={`badge ${u.approved ? 'badge-success' : 'badge-warning'}`}>
                            {u.approved ? 'Hoạt động' : 'Chờ duyệt'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setEditingUser({ ...u, additionalDepartments: u.additionalDepartments || [] })}
                            >
                              Sửa
                            </button>
                            <button
                              className={`btn btn-sm ${u.approved ? 'btn-secondary' : 'btn-primary'}`}
                              onClick={() => handleToggleApproval(u.uid, u.approved)}
                              disabled={u.uid === user.uid}
                            >
                              {u.approved ? 'Khóa' : 'Duyệt'}
                            </button>
                            {u.uid !== user.uid && (
                              <>
                                <button
                                  className="btn btn-sm" style={{ background: 'var(--color-warning)', color: '#fff' }}
                                  onClick={() => handleResetPassword(u.uid)}
                                  title="Reset mật khẩu về 123456"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteUser(u.uid)}
                                >
                                  Xóa
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingUser && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <div className="modal-content" style={{ background: '#fff', padding: 'var(--space-5)', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: 'var(--space-4)', fontSize: '1.25rem', fontWeight: 600 }}>Chỉnh sửa người dùng</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="form-label">Họ và tên</label>
                <input className="form-input" value={editingUser.displayName} onChange={e => setEditingUser(prev => ({ ...prev, displayName: e.target.value }))} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">Chức vụ</label>
                  <select className="form-input" value={editingUser.position || ''} onChange={e => setEditingUser(prev => ({ ...prev, position: e.target.value }))}>
                    <option value="">-- Thuộc --</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Chức danh</label>
                  <select className="form-input" value={editingUser.title || ''} onChange={e => setEditingUser(prev => ({ ...prev, title: e.target.value }))}>
                    <option value="">-- Thuộc --</option>
                    {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Vai trò</label>
                <select className="form-input" value={editingUser.role} onChange={e => setEditingUser(prev => ({ ...prev, role: e.target.value }))}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Khoa chính</label>
                <select className="form-input" value={editingUser.primaryDepartmentId || ''} onChange={e => setEditingUser(prev => ({ ...prev, primaryDepartmentId: e.target.value }))}>
                  <option value="">-- Không chọn --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Khoa bổ sung (kiêm nhiệm)</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select id="add-dept-select" className="form-input" style={{ flex: 1 }}>
                    <option value="">-- Chọn khoa để thêm --</option>
                    {departments.filter(d => d.id !== editingUser.primaryDepartmentId && !editingUser.additionalDepartments?.includes(d.id)).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-secondary" onClick={() => {
                    const sel = document.getElementById('add-dept-select');
                    handleAddAdditionalDept(sel.value);
                    sel.value = '';
                  }}>Thêm</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {editingUser.additionalDepartments?.map(deptId => {
                    const dName = departments.find(d => d.id === deptId)?.name || deptId;
                    return (
                      <span key={deptId} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-primary-100)', color: 'var(--color-primary-800)', padding: '4px 8px', borderRadius: '4px' }}>
                        {dName}
                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit', fontWeight: 'bold' }} onClick={() => handleRemoveAdditionalDept(deptId)}>×</button>
                      </span>
                    )
                  })}
                  {(!editingUser.additionalDepartments || editingUser.additionalDepartments.length === 0) && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)' }}>Chưa có khoa bổ sung</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
              <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSaveUser}>Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
            <span>{toast.msg}</span>
            <button 
              onClick={() => setToast(null)}
              className="btn btn-sm"
              style={{ background: 'rgba(255, 255, 255, 0.25)', color: 'inherit', border: 'none' }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
