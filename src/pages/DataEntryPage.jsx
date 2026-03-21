import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getReportsByDepartment, saveReport, initializeDepartmentReportsForMonth } from '../services/reportService';
import { getDepartments, seedInitialData } from '../services/departmentService';
import { getSettings } from '../services/settingsService';
import { canAccessDepartment } from '../services/authService';
import { computeBnHienTai } from '../utils/computedColumns';
import { getCurrentReportDate, formatDisplayDate, getDaysInMonthUpTo } from '../utils/dateUtils';
import { INPATIENT_FIELDS, REPORT_STATUS, ROLES } from '../utils/constants';

export default function DataEntryPage() {
  const { user } = useAuth();
  
  // App-level initialization state
  const [initLoading, setInitLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [reportDate, setReportDate] = useState('');
  
  // Selection state
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  // Data state
  const [monthReports, setMonthReports] = useState({});
  const [daysInMonth, setDaysInMonth] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
  }, []);

  // 1. Initial Load: settings, date, accessible departments
  useEffect(() => {
    async function initApp() {
      setInitLoading(true);
      try {
        await seedInitialData();
        const settings = await getSettings();
        const today = getCurrentReportDate(settings.autoLockHour);
        setReportDate(today);

        const allDepts = await getDepartments();
        const activeDepts = allDepts.filter((d) => d.active !== false);
        
        // Filter accessible departments
        const accessible = activeDepts.filter(d => {
          if (user.role === ROLES.ADMIN || user.role === ROLES.KEHOACH) return true;
          return canAccessDepartment(user, d.id);
        });
        
        setDepartments(accessible);

        if (accessible.length > 0) {
          let initialDeptId = accessible[0].id;
          if (accessible.length === 1) {
            initialDeptId = accessible[0].id;
          } else {
            const lastDept = localStorage.getItem('lastSelectedDept');
            if (lastDept && accessible.some(d => d.id === lastDept)) {
              initialDeptId = lastDept;
            }
          }
          setSelectedDeptId(initialDeptId);
        }
      } catch (err) {
        console.error('Init error:', err);
        showToast('Lỗi tải dữ liệu: ' + err.message, 'error');
      } finally {
        setInitLoading(false);
      }
    }
    initApp();
  }, [user, showToast]);

  // 2. Fetch data for selected department and month
  useEffect(() => {
    async function fetchMonthData() {
      if (!selectedDeptId || !reportDate) return;
      setDataLoading(true);
      try {
        const deptIdx = departments.findIndex(d => d.id === selectedDeptId);
        if (deptIdx === -1) return;
        const dept = departments[deptIdx];
        
        // Ensure all days up to today exist
        await initializeDepartmentReportsForMonth(reportDate, dept);
        
        // Fetch the whole month
        const days = getDaysInMonthUpTo(reportDate);
        setDaysInMonth(days);
        
        if (days.length > 0) {
          const fetchedReports = await getReportsByDepartment(selectedDeptId, days[0], reportDate);
          const reportsDict = {};
          fetchedReports.forEach(r => {
            reportsDict[r.date] = r;
          });
          setMonthReports(reportsDict);
        }
      } catch (err) {
        console.error('Fetch month data error:', err);
        showToast('Lỗi tải dữ liệu tháng: ' + err.message, 'error');
      } finally {
        setDataLoading(false);
      }
    }
    fetchMonthData();
  }, [selectedDeptId, reportDate, departments, showToast]);

  const handleDeptSelect = (e) => {
    const val = e.target.value;
    setSelectedDeptId(val);
    localStorage.setItem('lastSelectedDept', val);
  };

  const handleFieldChange = (date, field, value) => {
    const numValue = value === '' ? 0 : parseInt(value, 10) || 0;

    setMonthReports((prev) => {
      const newState = { ...prev };
      const prevReport = newState[date] || {};
      const updated = { ...prevReport, [field]: numValue };
      updated.bnHienTai = computeBnHienTai(updated);
      newState[date] = updated;

      // Local Cascade: instantly update BN Cũ and BN Hiện Tại for subsequent days
      const startIndex = daysInMonth.indexOf(date);
      if (startIndex !== -1) {
        let currentBnHienTai = updated.bnHienTai;
        for (let i = startIndex + 1; i < daysInMonth.length; i++) {
          const nextDate = daysInMonth[i];
          const nextReport = { ...(newState[nextDate] || {}) };
          nextReport.bnCu = currentBnHienTai;
          nextReport.bnHienTai = computeBnHienTai(nextReport);
          newState[nextDate] = nextReport;
          currentBnHienTai = nextReport.bnHienTai;
        }
      }

      return newState;
    });
  };

  const handleAutoSaveRow = async (date) => {
    const report = monthReports[date];
    if (!report || !canEdit(report)) return;

    const dept = departments.find((d) => d.id === selectedDeptId);
    if (!dept) return;

    try {
      await saveReport(
        date,
        selectedDeptId,
        dept.name,
        dept.facilityId,
        {
          bnCu: report.bnCu || 0,
          vaoVien: report.vaoVien || 0,
          chuyenDen: report.chuyenDen || 0,
          chuyenDi: report.chuyenDi || 0,
          raVien: report.raVien || 0,
          tuVong: report.tuVong || 0,
          chuyenVien: report.chuyenVien || 0,
        },
        user
      );
    } catch (err) {
      console.error('Lỗi auto-save:', err);
      showToast('Lỗi tự động lưu: ' + err.message, 'error');
    }
  };

  const handleSaveRow = async (date) => {
    const report = monthReports[date];
    if (!report) return;

    const dept = departments.find((d) => d.id === selectedDeptId);
    if (!dept) return;

    setSaving((prev) => ({ ...prev, [date]: true }));
    try {
      await saveReport(
        date,
        selectedDeptId,
        dept.name,
        dept.facilityId,
        {
          bnCu: report.bnCu || 0,
          vaoVien: report.vaoVien || 0,
          chuyenDen: report.chuyenDen || 0,
          chuyenDi: report.chuyenDi || 0,
          raVien: report.raVien || 0,
          tuVong: report.tuVong || 0,
          chuyenVien: report.chuyenVien || 0,
        },
        user
      );
      showToast(`Đã lưu ${formatDisplayDate(date)}`);
      
      // Re-fetch all reports for the month to ensure client state reflects 
      // cascading 'bnCu' & 'bnHienTai' changes on subsequent dates.
      const fetchedReports = await getReportsByDepartment(selectedDeptId, daysInMonth[0], reportDate);
      const reportsDict = {};
      fetchedReports.forEach(r => {
        reportsDict[r.date] = r;
      });
      setMonthReports(reportsDict);
      
    } catch (err) {
      showToast('Lỗi lưu: ' + err.message, 'error');
    } finally {
      setSaving((prev) => ({ ...prev, [date]: false }));
    }
  };

  const handleSaveAll = async () => {
    const dept = departments.find((d) => d.id === selectedDeptId);
    if (!dept) return;

    // Filter only editable rows to save
    const editableDays = daysInMonth.filter(dateStr => {
      const report = monthReports[dateStr];
      return canEdit(report);
    });

    if (editableDays.length === 0) {
      showToast('Không có dữ liệu nào có thể lưu.', 'warning');
      return;
    }

    setSaving((prev) => {
      const newSaving = { ...prev };
      editableDays.forEach(d => newSaving[d] = true);
      return newSaving;
    });

    try {
      const promises = editableDays.map(date => {
        const report = monthReports[date] || {};
        return saveReport(
          date,
          selectedDeptId,
          dept.name,
          dept.facilityId,
          {
            bnCu: report.bnCu || 0,
            vaoVien: report.vaoVien || 0,
            chuyenDen: report.chuyenDen || 0,
            chuyenDi: report.chuyenDi || 0,
            raVien: report.raVien || 0,
            tuVong: report.tuVong || 0,
            chuyenVien: report.chuyenVien || 0,
          },
          user
        );
      });

      await Promise.all(promises);
      showToast(`Đã lưu thành công ${editableDays.length} ngày`);
      
      const fetchedReports = await getReportsByDepartment(selectedDeptId, daysInMonth[0], reportDate);
      const reportsDict = {};
      fetchedReports.forEach(r => {
        reportsDict[r.date] = r;
      });
      setMonthReports(reportsDict);
      
    } catch (err) {
      showToast('Lỗi lưu hàng loạt: ' + err.message, 'error');
    } finally {
      setSaving((prev) => {
        const newSaving = { ...prev };
        editableDays.forEach(d => newSaving[d] = false);
        return newSaving;
      });
    }
  };

  function canEdit(report) {
    if (!report || report.status === REPORT_STATUS.LOCKED) return false;
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.KEHOACH) return true;
    return canAccessDepartment(user, report.departmentId);
  }

  // Calculate totals
  const totals = useMemo(() => {
    const defaultTotals = { 
      bnCu: 0, vaoVien: 0, chuyenDen: 0, chuyenDi: 0, 
      raVien: 0, tuVong: 0, chuyenVien: 0, bnHienTai: 0 
    };
    if (daysInMonth.length === 0) return defaultTotals;
    
    let sumVaoVien = 0, sumChuyenDen = 0, sumChuyenDi = 0;
    let sumRaVien = 0, sumTuVong = 0, sumChuyenVien = 0;
    
    daysInMonth.forEach(day => {
      const r = monthReports[day] || {};
      sumVaoVien += (r.vaoVien || 0);
      sumChuyenDen += (r.chuyenDen || 0);
      sumChuyenDi += (r.chuyenDi || 0);
      sumRaVien += (r.raVien || 0);
      sumTuVong += (r.tuVong || 0);
      sumChuyenVien += (r.chuyenVien || 0);
    });
    
    const firstDay = daysInMonth[0];
    const lastDay = daysInMonth[daysInMonth.length - 1];
    
    return {
      bnCu: (monthReports[firstDay]?.bnCu) || 0,
      vaoVien: sumVaoVien,
      chuyenDen: sumChuyenDen,
      chuyenDi: sumChuyenDi,
      raVien: sumRaVien,
      tuVong: sumTuVong,
      chuyenVien: sumChuyenVien,
      bnHienTai: (monthReports[lastDay]?.bnHienTai) || 0,
    };
  }, [daysInMonth, monthReports]);


  if (initLoading) {
    return (
      <div className="app-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
          <div>Đang khởi tạo ứng dụng...</div>
        </div>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="app-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', maxWidth: '400px' }}>
          <h3>Không có quyền truy cập</h3>
          <p className="text-muted">Bạn chưa được phân quyền nhập liệu cho khoa nào.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <h1 className="app-header__title">📝 Nhập số liệu nội trú</h1>
        </div>
        <div className="app-header__right" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <select 
              className="input" 
              value={selectedDeptId} 
              onChange={handleDeptSelect}
              style={{ minWidth: '200px', backgroundColor: 'var(--bg-card)' }}
              aria-label="Chọn Khoa/Phòng"
            >
              <optgroup label="Chọn Khoa/Phòng">
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <button 
            className="btn btn-primary"
            onClick={handleSaveAll}
            disabled={Object.values(saving).some(s => s) || !daysInMonth.some(d => canEdit(monthReports[d]))}
          >
            Lưu tất cả
          </button>
          <span className="badge badge-info" style={{ padding: '4px 12px', whiteSpace: 'nowrap' }}>
            Tháng {reportDate.substring(5, 7)}/{reportDate.substring(0, 4)}
          </span>
        </div>
      </header>

      <div className="app-content">
        <div className="card">
          {dataLoading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Đang tải số liệu tháng...</div>
          ) : (
            <div style={{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '100px' }}>Ngày</th>
                    <th style={{ minWidth: '60px' }}>Trạng thái</th>
                    {INPATIENT_FIELDS.map((f) => (
                      <th key={f.key} className="col-number" style={{ minWidth: '80px' }}>
                        {f.label}
                      </th>
                    ))}
                    <th style={{ minWidth: '80px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {daysInMonth.map((dateStr) => {
                    const report = monthReports[dateStr] || {};
                    const isLocked = report.status === REPORT_STATUS.LOCKED;
                    const editable = canEdit(report);
                    // Highlight rows that are open for edit
                    const rowClass = editable ? 'row-highlight-active' : '';

                    return (
                      <tr key={dateStr} className={rowClass}>
                        <td style={{ fontWeight: 500 }}>{formatDisplayDate(dateStr)}</td>
                        <td>
                          <span className={`data-entry-status`}>
                            <span className={`status-dot status-dot--${isLocked ? 'locked' : 'open'}`} />
                            <span style={{ fontSize: '0.75rem' }}>
                              {isLocked ? 'Đã khóa' : 'Đang mở'}
                            </span>
                          </span>
                        </td>
                        {INPATIENT_FIELDS.map((field) => (
                          <td
                            key={field.key}
                            className={field.computed ? 'col-computed' : 'col-number'}
                          >
                            {field.editable && editable ? (
                              <input
                                type="number"
                                min="0"
                                aria-label={`Nhập ${field.label} ngày ${formatDisplayDate(dateStr)}`}
                                value={report[field.key] ?? 0}
                                onChange={(e) =>
                                  handleFieldChange(dateStr, field.key, e.target.value)
                                }
                                onBlur={() => handleAutoSaveRow(dateStr)}
                              />
                            ) : (
                              <span>{report[field.key] ?? 0}</span>
                            )}
                          </td>
                        ))}
                        <td>
                          {editable ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSaveRow(dateStr)}
                              disabled={saving[dateStr]}
                            >
                              {saving[dateStr] ? '...' : 'Lưu'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {isLocked ? '🔒' : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-body)', fontWeight: 600 }}>
                    <td colSpan="2" style={{ textAlign: 'right', paddingRight: 'var(--space-4)' }}>Tổng cộng (Tháng):</td>
                    {INPATIENT_FIELDS.map((field) => (
                      <td key={'total_' + field.key} className="col-number" style={{ color: 'var(--primary)' }}>
                        {totals[field.key]}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
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
