import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getReportsByDate, lockReportsByDate, unlockReport } from '../services/reportService';
import { getSettings, updateSettings } from '../services/settingsService';
import { formatDisplayDate, getToday, getYesterday } from '../utils/dateUtils';
import { REPORT_STATUS, ROLES } from '../utils/constants';
import { format, subDays } from 'date-fns';

export default function LockManagementPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [settings, setSettingsState] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
  }

  async function loadData(date) {
    setLoading(true);
    try {
      const [reps, sets] = await Promise.all([getReportsByDate(date), getSettings()]);
      setReports(reps);
      setSettingsState(sets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  async function handleLockAll() {
    try {
      await lockReportsByDate(selectedDate, user.displayName);
      showToast(`Đã khóa tất cả số liệu ngày ${formatDisplayDate(selectedDate)}`);
      await loadData(selectedDate);
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  }

  async function handleUnlock(reportId, deptName) {
    try {
      await unlockReport(reportId);
      showToast(`Đã mở khóa ${deptName}`);
      await loadData(selectedDate);
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  }

  async function handleToggleAutoLock() {
    const newValue = !settings.autoLockEnabled;
    await updateSettings({ autoLockEnabled: newValue });
    setSettingsState((prev) => ({ ...prev, autoLockEnabled: newValue }));
    showToast(`Khóa tự động: ${newValue ? 'BẬT' : 'TẮT'}`);
  }

  async function handleAutoLockHourChange(e) {
    const hour = parseInt(e.target.value, 10);
    await updateSettings({ autoLockHour: hour });
    setSettingsState((prev) => ({ ...prev, autoLockHour: hour }));
    showToast(`Giờ khóa tự động: ${hour}h`);
  }

  const lockedCount = reports.filter((r) => r.status === REPORT_STATUS.LOCKED).length;
  const openCount = reports.filter((r) => r.status === REPORT_STATUS.OPEN).length;

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <h1 className="app-header__title">🔒 Quản lý khóa số liệu</h1>
        </div>
      </header>

      <div className="app-content">
        {/* Auto-lock settings */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-header">
            <h2 className="card-title">Cài đặt khóa tự động</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoLockEnabled || false}
                onChange={handleToggleAutoLock}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-500)' }}
              />
              <span style={{ fontWeight: 500 }}>Bật khóa tự động</span>
            </label>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-2)' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Giờ khóa:</label>
              <select
                className="form-input"
                value={settings.autoLockHour || 8}
                onChange={handleAutoLockHourChange}
                style={{ width: '80px' }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}:00</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Date selector + actions */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div className="form-group">
              <label className="form-label">Chọn ngày</label>
              <input
                type="date"
                className="form-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(getYesterday())}>
                Hôm qua
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(getToday())}>
                Hôm nay
              </button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginLeft: 'auto' }}>
              <span className="badge badge-success" style={{ padding: '4px 10px' }}>
                Mở: {openCount}
              </span>
              <span className="badge badge-error" style={{ padding: '4px 10px' }}>
                Khóa: {lockedCount}
              </span>
            </div>

            {openCount > 0 && (
              <button className="btn btn-danger btn-sm" onClick={handleLockAll}>
                🔒 Khóa tất cả
              </button>
            )}
          </div>
        </div>

        {/* Reports list */}
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Khoa</th>
                  <th>Trạng thái</th>
                  <th>Người nhập</th>
                  <th>Khóa bởi</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>Đang tải...</td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      Không có báo cáo cho ngày {formatDisplayDate(selectedDate)}
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.departmentName}</td>
                      <td>
                        <span className="data-entry-status">
                          <span className={`status-dot status-dot--${r.status === REPORT_STATUS.LOCKED ? 'locked' : 'open'}`} />
                          {r.status === REPORT_STATUS.LOCKED ? 'Đã khóa' : 'Đang mở'}
                        </span>
                      </td>
                      <td>{r.reportedBy || '—'}</td>
                      <td>{r.lockedBy || '—'}</td>
                      <td>
                        {r.status === REPORT_STATUS.LOCKED && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleUnlock(r.id, r.departmentName)}
                          >
                            🔓 Mở khóa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
