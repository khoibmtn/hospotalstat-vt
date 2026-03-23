import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getReportsByDepartment, saveReport, initializeDepartmentReportsForMonth } from '../services/reportService';
import { getDepartments, seedInitialData } from '../services/departmentService';
import { getSettings } from '../services/settingsService';
import { canAccessDepartment } from '../services/authService';
import { computeBnHienTai } from '../utils/computedColumns';
import { getCurrentReportDate, formatDisplayDate, getDaysInMonthUpTo, shouldAutoLock } from '../utils/dateUtils';
import { INPATIENT_FIELDS, REPORT_STATUS, ROLES } from '../utils/constants';
import { getDiseaseCatalog } from '../services/diseaseCatalogService';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, FileText, CheckCircle2, AlertCircle, Lock, Unlock, Plus, Trash2 } from 'lucide-react';

export default function DataEntryPage() {
  const { user } = useAuth();
  
  // App-level initialization state
  const [initLoading, setInitLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [reportDate, setReportDate] = useState('');
  const [detailDate, setDetailDate] = useState('');
  const [settings, setSettings] = useState(null);
  
  // Selection state
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  // Data state
  const [monthReports, setMonthReports] = useState({});
  const [daysInMonth, setDaysInMonth] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);
  const [diseaseCatalog, setDiseaseCatalog] = useState([]);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
  }, []);

  // 1. Initial Load: settings, date, accessible departments
  useEffect(() => {
    async function initApp() {
      setInitLoading(true);
      try {
        await seedInitialData();
        const settingsData = await getSettings();
        setSettings(settingsData);
        const today = getCurrentReportDate(settingsData.autoLockHour);
        setReportDate(today);
        setDetailDate(today);

        // Fetch disease catalog separately so a failure doesn't block other data
        try {
          const diseaseCat = await getDiseaseCatalog();
          setDiseaseCatalog(diseaseCat);
        } catch (e) {
          console.warn('Disease catalog not yet available:', e.message);
          setDiseaseCatalog([]);
        }

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

  const handleDeptSelect = (val) => {
    setSelectedDeptId(val);
    localStorage.setItem('lastSelectedDept', val);
  };

  const handleFieldChange = (date, field, value) => {
    const isStringField = field === 'shiftName';
    const finalValue = isStringField ? value : (value === '' ? 0 : parseInt(value, 10) || 0);

    setMonthReports((prev) => {
      const newState = { ...prev };
      const prevReport = newState[date] || {};
      const updated = { ...prevReport, [field]: finalValue };
      
      if (!isStringField) {
        updated.bnHienTai = computeBnHienTai(updated);
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
      }
      
      newState[date] = updated;
      return newState;
    });
  };

  const handleDiseaseChange = (date, idx, field, value) => {
    let finalValue = value;
    if (field !== 'diseaseName') {
        finalValue = value === '' ? 0 : parseInt(value, 10) || 0;
    }

    setMonthReports((prev) => {
      const newState = { ...prev };
      const prevReport = newState[date] || {};
      const newInfectious = [...(prevReport.infectiousData || [])];
      
      const updatedDisease = { ...newInfectious[idx], [field]: finalValue };
      if (field !== 'diseaseName') {
         updatedDisease.bnHienTai = computeBnHienTai(updatedDisease);
      }
      newInfectious[idx] = updatedDisease;
      newState[date] = { ...prevReport, infectiousData: newInfectious };

      // Local Cascade for diseases
      if (field !== 'diseaseName') {
        const startIndex = daysInMonth.indexOf(date);
        if (startIndex !== -1) {
          let currentBnHienTai = updatedDisease.bnHienTai;
          const dName = updatedDisease.diseaseName;
          
          if (dName) {
             for (let i = startIndex + 1; i < daysInMonth.length; i++) {
                const nextDate = daysInMonth[i];
                const nextReport = { ...(newState[nextDate] || {}) };
                const nextInf = [...(nextReport.infectiousData || [])];
                
                const nextIdx = nextInf.findIndex(d => d.diseaseName === dName);
                if (nextIdx >= 0) {
                   const nextUpd = { ...nextInf[nextIdx], bnCu: currentBnHienTai };
                   nextUpd.bnHienTai = computeBnHienTai(nextUpd);
                   nextInf[nextIdx] = nextUpd;
                   currentBnHienTai = nextUpd.bnHienTai;
                } else if (currentBnHienTai > 0) {
                   const gen = {
                      diseaseName: dName,
                      bnCu: currentBnHienTai,
                      vaoVien: 0, chuyenDen: 0, chuyenDi: 0,
                      raVien: 0, tuVong: 0, chuyenVien: 0,
                      bnHienTai: currentBnHienTai
                   };
                   nextInf.push(gen);
                }
                newState[nextDate] = { ...nextReport, infectiousData: nextInf };
             }
          }
        }
      }
      return newState;
    });
  };

  const handleAddDisease = (date) => {
    setMonthReports((prev) => {
      const newState = { ...prev };
      const prevReport = newState[date] || {};
      const newInfectious = [...(prevReport.infectiousData || [])];
      newInfectious.push({
         diseaseName: '',
         bnCu: 0, vaoVien: 0, chuyenDen: 0, chuyenDi: 0,
         raVien: 0, tuVong: 0, chuyenVien: 0, bnHienTai: 0
      });
      newState[date] = { ...prevReport, infectiousData: newInfectious };
      return newState;
    });
  };

  const handleRemoveDisease = (date, idx) => {
    setMonthReports((prev) => {
      const newState = { ...prev };
      const prevReport = newState[date] || {};
      const newInfectious = [...(prevReport.infectiousData || [])];
      newInfectious.splice(idx, 1);
      newState[date] = { ...prevReport, infectiousData: newInfectious };
      return newState;
    });
    // Triggers auto-save via handleAutoSaveRow if attached to trash button click
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
      const currentIndex = inputs.indexOf(e.target);
      if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
        inputs[currentIndex + 1].select();
      } else {
        e.target.blur();
      }
    }
  };

  const handleAutoSaveRow = async (date) => {
    const report = monthReports[date];
    if (!report || !canEdit(report, date)) return;

    const dept = departments.find((d) => d.id === selectedDeptId);
    if (!dept) return;

    try {
      await saveReport(
        date,
        selectedDeptId,
        dept.name,
        dept.facilityId,
        {
          shiftName: report.shiftName || '',
          infectiousData: report.infectiousData || [],
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
      return canEdit(report, dateStr);
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
            shiftName: report.shiftName || '',
            infectiousData: report.infectiousData || [],
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

  function canEdit(report, dateStr) {
    if (!report) return false;
    const explicitlyLocked = report.status === REPORT_STATUS.LOCKED;
    const autoLocked = settings?.autoLockEnabled && shouldAutoLock(dateStr, settings.autoLockHour);
    if (explicitlyLocked || autoLocked) return false;
    
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-slate-500 animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-500" />
          <div className="font-medium">Đang khởi tạo ứng dụng...</div>
        </div>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full text-center p-8 shadow-sm">
          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Không có quyền truy cập</h3>
          <p className="text-slate-500">Bạn chưa được phân quyền nhập liệu cho khoa nào.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 pb-24 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Nhập số liệu nội trú
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedDeptId} onValueChange={handleDeptSelect}>
            <SelectTrigger className="w-full md:w-[240px] bg-white border border-slate-300 rounded-md shadow-sm hover:border-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
              <SelectValue placeholder="Chọn Khoa/Phòng" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleSaveAll}
            disabled={Object.values(saving).some(s => s) || !daysInMonth.some(d => canEdit(monthReports[d], d))}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Lưu tất cả
          </Button>
          <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 border-blue-100">
            Tháng {reportDate.substring(5, 7)}/{reportDate.substring(0, 4)}
          </Badge>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden shadow-sm border-slate-200 flex flex-col bg-white">
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col h-full relative">
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 h-full">
               <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-500" />
               <p className="font-medium">Đang tải số liệu tháng...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-white rounded-b-xl border-t border-slate-100">
              <table className="w-full text-sm text-left border-collapse tabular-nums">
                <thead className="text-xs text-white uppercase bg-blue-600 sticky top-0 z-20 shadow-md">
                  <tr>
                    <th className="px-3 py-3 font-semibold border-r border-blue-500 sticky left-0 z-30 bg-blue-600 min-w-[100px] shadow-[1px_0_0_0_#3b82f6]">Ngày</th>
                    <th className="px-2 py-3 font-semibold border-r border-blue-500 min-w-[90px] text-center">Trạng thái</th>
                    {INPATIENT_FIELDS.map((f) => (
                      <th key={f.key} className="px-2 py-3 font-semibold border-r border-blue-500 min-w-[70px] text-center">
                        {f.label}
                      </th>
                    ))}
                    <th className="px-3 py-3 font-semibold border-blue-500 min-w-[80px] text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {daysInMonth.map((dateStr) => {
                    const report = monthReports[dateStr] || {};
                    const explicitlyLocked = report.status === REPORT_STATUS.LOCKED;
                    const autoLocked = settings?.autoLockEnabled && shouldAutoLock(dateStr, settings.autoLockHour);
                    const isLocked = explicitlyLocked || autoLocked;
                    const editable = canEdit(report, dateStr);
                    const rowClass = editable ? 'bg-white group even:bg-slate-50 odd:bg-white hover:bg-slate-200 focus-within:bg-blue-100 focus-within:hover:bg-blue-100 transition-colors' : 'bg-slate-50 text-slate-500';

                    return (
                      <tr key={dateStr} onClick={() => setDetailDate(dateStr)} className={`${rowClass} border-b border-slate-200 cursor-pointer ${detailDate === dateStr ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/30' : ''}`}>
                        <td className={`px-3 py-2 font-medium border-r border-slate-200 sticky left-0 z-10 tabular-nums whitespace-nowrap text-slate-900 transition-colors shadow-[1px_0_0_0_#e2e8f0] ${editable ? (detailDate === dateStr ? 'bg-blue-50/50' : 'bg-white group-even:bg-slate-50 group-hover:bg-slate-200 group-focus-within:bg-blue-100 group-focus-within:hover:bg-blue-100') : 'bg-slate-50'}`}>
                          {formatDisplayDate(dateStr)}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-100 text-center">
                          <div className={`mx-auto flex items-center justify-center w-7 h-7 rounded-sm transition-colors ${explicitlyLocked ? 'bg-slate-100 text-slate-500' : autoLocked ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`} title={explicitlyLocked ? "Đã khóa (Thủ công)" : autoLocked ? "Khóa tự động theo cài đặt hệ thống" : "Đang mở"}>
                            {explicitlyLocked || autoLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </div>
                        </td>
                        {INPATIENT_FIELDS.map((field) => (
                          <td
                            key={field.key}
                            className={`px-1 py-1 border-r border-slate-100 text-center align-middle ${field.computed ? 'bg-slate-50/50 font-semibold text-slate-700' : ''}`}
                          >
                            {field.editable && editable ? (
                              <div className="relative group-focus-within:z-10 mx-auto w-16">
                                <input
                                  type="number"
                                  min="0"
                                  aria-label={`Nhập ${field.label} ngày ${formatDisplayDate(dateStr)}`}
                                  className="w-full h-8 px-1 text-center bg-white border border-slate-300 rounded-md shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all tabular-nums text-slate-900 font-medium"
                                  value={report[field.key] ?? 0}
                                  onChange={(e) =>
                                    handleFieldChange(dateStr, field.key, e.target.value)
                                  }
                                  onBlur={() => handleAutoSaveRow(dateStr)}
                                  onKeyDown={handleKeyDown}
                                  onFocus={(e) => e.target.select()}
                                />
                              </div>
                            ) : (
                              <span className="block mx-auto min-w-[2rem]">{report[field.key] ?? 0}</span>
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center align-middle">
                          {editable ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 w-8 p-0 text-blue-600 bg-white hover:bg-blue-600 hover:text-white shadow-sm border border-slate-300 group-hover:border-blue-200 transition-all"
                              onClick={() => handleSaveRow(dateStr)}
                              disabled={saving[dateStr]}
                              title="Lưu dòng này"
                            >
                              {saving[dateStr] ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {isLocked ? '🔒' : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-20 bg-blue-100 shadow-[0_-1px_2px_-1px_rgba(0,0,0,0.1)] border-t-2 border-blue-200">
                  <tr className="font-bold text-blue-900">
                    <td colSpan="2" className="px-3 py-4 text-right uppercase text-[13px] border-r border-blue-200 sticky left-0 z-10 bg-blue-100 shadow-[1px_0_0_0_#bfdbfe]">
                      Tổng cộng (Tháng):
                    </td>
                    {INPATIENT_FIELDS.map((field) => (
                      <td key={'total_' + field.key} className="px-2 py-4 text-center border-r border-blue-200 text-blue-700 text-base">
                        {totals[field.key]}
                      </td>
                    ))}
                    <td className="px-3 py-4 text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chi tiết báo cáo ng​ày (Shift Name & Infectious Diseases) */}
      {!dataLoading && daysInMonth.length > 0 && detailDate && (
        <Card className="flex-none mt-6 overflow-visible shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4 md:p-6 overflow-visible">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 <AlertCircle className="w-5 h-5 text-blue-500" />
                 Chi tiết báo cáo
              </h3>
              <div className="flex items-center gap-3 mt-4 md:mt-0">
                <span className="text-sm font-medium text-slate-600">Chọn ngày:</span>
                <Select value={detailDate} onValueChange={setDetailDate}>
                  <SelectTrigger className="w-[150px] bg-white border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {daysInMonth.map(d => (
                      <SelectItem key={d} value={d}>{formatDisplayDate(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(() => {
               const rep = monthReports[detailDate] || {};
               const editable = canEdit(rep, detailDate);
               const infectiousData = rep.infectiousData || [];
               
               return (
                 <div className="space-y-6">
                   <div className="flex flex-col md:flex-row md:items-end gap-4">
                     <div className="flex-1 max-w-sm">
                        <Label htmlFor="shiftName" className="text-slate-600 mb-2 block font-medium">Tên tua trực / Trưởng tua trực</Label>
                        <Input 
                          id="shiftName"
                          value={rep.shiftName || ''}
                          onChange={(e) => handleFieldChange(detailDate, 'shiftName', e.target.value)}
                          onBlur={() => handleAutoSaveRow(detailDate)}
                          disabled={!editable}
                          placeholder="Nhập tên tuyến trực..."
                          className="bg-white border-slate-300 focus:ring-blue-500 h-10 shadow-sm"
                        />
                     </div>
                     {!editable && (
                        <div className="text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-md flex items-center gap-2 h-10 border border-slate-200">
                          <Lock className="w-4 h-4 text-slate-500"/> Chế độ xem (Đã khóa)
                        </div>
                     )}
                   </div>
                   
                   <div className="pt-6 border-t border-slate-200">
                     <div className="flex items-center justify-between mb-4">
                       <h4 className="font-semibold text-slate-800 text-base">Số liệu Bệnh truyền nhiễm (Nếu có)</h4>
                       {editable && (
                         <Button variant="outline" size="sm" onClick={() => handleAddDisease(detailDate)} className="border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 shadow-sm">
                           <Plus className="w-4 h-4 mr-1.5"/> Báo cáo thêm Bệnh Truyền Nhiễm
                         </Button>
                       )}
                     </div>
                     
                     {infectiousData.length === 0 ? (
                       <div className="text-center py-10 text-slate-500 bg-slate-50/80 rounded-lg border border-dashed border-slate-300">
                         Không có dữ liệu bệnh truyền nhiễm cho ngày này.
                       </div>
                     ) : (
                       <div className="overflow-x-auto rounded-lg border border-slate-200">
                         <table className="w-full text-sm text-left border-collapse tabular-nums min-w-[900px]">
                           <thead className="text-[11px] text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                             <tr>
                               <th className="px-3 py-3 font-semibold w-[220px]">Tên bệnh truyền nhiễm</th>
                               {INPATIENT_FIELDS.map(f => (
                                 <th key={f.key} className="px-2 py-3 font-semibold text-center leading-tight">{f.label}</th>
                               ))}
                               {editable && <th className="px-2 py-3 text-center w-[50px]"></th>}
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 bg-white">
                             {infectiousData.map((disease, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 focus-within:bg-blue-50/50 transition-colors group">
                                  <td className="px-3 py-2">
                                    {editable ? (
                                      <Select value={disease.diseaseName} onValueChange={(val) => {handleDiseaseChange(detailDate, idx, 'diseaseName', val); handleAutoSaveRow(detailDate);}}>
                                        <SelectTrigger className="w-full h-9 bg-white border-slate-300 shadow-sm">
                                          <SelectValue placeholder="Chọn loại bệnh..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {diseaseCatalog.map(d => (
                                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <span className="font-medium text-slate-800 px-2">{disease.diseaseName || '—'}</span>
                                    )}
                                  </td>
                                  {INPATIENT_FIELDS.map(f => (
                                    <td key={f.key} className={`px-1 py-1 text-center align-middle ${f.computed ? 'bg-slate-50 font-semibold text-slate-700' : ''}`}>
                                      {f.editable && editable ? (
                                        <input
                                          type="number" min="0" placeholder="0"
                                          className="w-14 h-9 px-1 text-center bg-white border border-slate-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all tabular-nums text-slate-900 mx-auto block"
                                          value={disease[f.key] ?? ''}
                                          onChange={(e) => handleDiseaseChange(detailDate, idx, f.key, e.target.value)}
                                          onBlur={() => handleAutoSaveRow(detailDate)}
                                          onKeyDown={handleKeyDown}
                                          onFocus={(e) => e.target.select()}
                                        />
                                      ) : (
                                        <span className="block mx-auto min-w-[2rem] text-slate-600">{disease[f.key] ?? 0}</span>
                                      )}
                                    </td>
                                  ))}
                                  {editable && (
                                    <td className="px-2 py-2 text-center align-middle">
                                       <Button variant="ghost" size="sm" onClick={() => { handleRemoveDisease(detailDate, idx); setTimeout(() => handleAutoSaveRow(detailDate), 50); }} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors">
                                         <Trash2 className="w-4 h-4"/>
                                       </Button>
                                    </td>
                                  )}
                                </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     )}
                   </div>
                 </div>
               );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Tailwind Toast implementation (Basic) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            <span className="font-medium text-sm">{toast.msg}</span>
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setToast(null)}
              className={`h-6 w-6 p-0 rounded-full hover:bg-black/5 ml-2`}
            >
              ×
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
