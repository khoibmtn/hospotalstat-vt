import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getReportsByDepartment, saveReport, initializeDepartmentReportsForMonth } from '../services/reportService';
import { getDepartments, seedInitialData } from '../services/departmentService';
import { getSettings } from '../services/settingsService';
import { canAccessDepartment } from '../services/authService';
import { computeBnHienTai } from '../utils/computedColumns';
import { validateReportRow, isFilledRow } from '../utils/validation';
import { getCurrentReportDate, formatDisplayDate, getDaysInMonthUpTo, getAllDaysInMonth, clampDateToMonth, shouldAutoLock } from '../utils/dateUtils';
import { INPATIENT_FIELDS, REPORT_STATUS, ROLES } from '../utils/constants';
import { getDiseaseCatalog } from '../services/diseaseCatalogService';
import { parse, subMonths, addMonths, format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, FileText, CheckCircle2, AlertCircle, Lock, Unlock, Plus, Trash2, ChevronLeft, ChevronRight, CalendarDays, RotateCcw } from 'lucide-react';
import InfectiousEntryTab from '@/components/data-entry/InfectiousEntryTab';
import DeathReportTab from '@/components/data-entry/DeathReportTab';

export default function DataEntryPage() {
  const { user } = useAuth();
  
  // App-level initialization state
  const [initLoading, setInitLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [reportDate, setReportDate] = useState('');       // anchor: today's shift date
  const [selectedDate, setSelectedDate] = useState('');    // primary nav state
  const [detailDate, setDetailDate] = useState('');
  const [settings, setSettings] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Derived: viewMonth = YYYY-MM from selectedDate
  const viewMonth = selectedDate ? selectedDate.substring(0, 7) : '';
  const isCurrentMonth = viewMonth === reportDate.substring(0, 7);

  // Ref for auto-scroll to selected date row
  const selectedDateRowRef = useRef(null);
  
  // Selection state
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  // Data state
  const [monthReports, setMonthReports] = useState({});
  const [daysInMonth, setDaysInMonth] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);
  const [diseaseCatalog, setDiseaseCatalog] = useState([]);

  // Ref to always access latest monthReports (avoids stale closure in handleAutoSaveRow)
  const monthReportsRef = useRef(monthReports);

  // Wrapper that keeps the ref in sync synchronously before React commits
  const updateMonthReports = useCallback((updater) => {
    setMonthReports((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      monthReportsRef.current = next;
      return next;
    });
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
  }, []);

  const getFilledDeathRowsCount = useCallback((dateStr) => {
    const report = monthReports[dateStr];
    if (!report || !report.deathCases) return 0;
    return report.deathCases.filter(isFilledRow).length;
  }, [monthReports]);

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
        setSelectedDate(today);
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

  // 2. Fetch data for selected department and month (triggered by viewMonth change)
  useEffect(() => {
    async function fetchMonthData() {
      if (!selectedDeptId || !selectedDate || !reportDate) return;
      setDataLoading(true);
      try {
        const deptIdx = departments.findIndex(d => d.id === selectedDeptId);
        if (deptIdx === -1) return;
        const dept = departments[deptIdx];

        // Determine which days to show
        const currentYM = reportDate.substring(0, 7);
        const selectedYM = selectedDate.substring(0, 7);
        let days;

        if (selectedYM === currentYM) {
          // Current month: only up to today
          days = getDaysInMonthUpTo(reportDate);
        } else {
          // Past month: show all days
          days = getAllDaysInMonth(selectedYM);
        }

        // Init safeguard: only create missing docs for ≤3 months ago
        const threeMonthsAgo = format(subMonths(new Date(), 3), 'yyyy-MM');
        const endDate = days[days.length - 1];
        if (selectedYM >= threeMonthsAgo) {
          await initializeDepartmentReportsForMonth(endDate, dept);
        }

        setDaysInMonth(days);

        if (days.length > 0) {
          const fetchedReports = await getReportsByDepartment(selectedDeptId, days[0], days[days.length - 1]);
          const reportsDict = {};
          fetchedReports.forEach(r => {
            reportsDict[r.date] = r;
          });
          updateMonthReports(reportsDict);
        }
      } catch (err) {
        console.error('Fetch month data error:', err);
        showToast('Lỗi tải dữ liệu tháng: ' + err.message, 'error');
      } finally {
        setDataLoading(false);
      }
    }
    fetchMonthData();
  }, [selectedDeptId, viewMonth, departments, reportDate, showToast]);

  // 3. Auto-scroll to selected date row after data loads
  useEffect(() => {
    if (!dataLoading && selectedDateRowRef.current) {
      selectedDateRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [dataLoading, selectedDate]);

  // --- Navigation handlers ---
  const handlePrevMonth = useCallback(() => {
    const current = parse(selectedDate, 'yyyy-MM-dd', new Date());
    const prev = subMonths(current, 1);
    const prevYM = format(prev, 'yyyy-MM');
    const newDate = clampDateToMonth(selectedDate, prevYM);
    setSelectedDate(newDate);
    setDetailDate(newDate);
  }, [selectedDate]);

  const handleNextMonth = useCallback(() => {
    const current = parse(selectedDate, 'yyyy-MM-dd', new Date());
    const next = addMonths(current, 1);
    const nextYM = format(next, 'yyyy-MM');
    const currentYM = reportDate.substring(0, 7);
    // Block navigating past current month
    if (nextYM > currentYM) return;
    const newDate = nextYM === currentYM
      ? reportDate  // Snap to today if entering current month
      : clampDateToMonth(selectedDate, nextYM);
    setSelectedDate(newDate);
    setDetailDate(newDate);
  }, [selectedDate, reportDate]);

  const handleGoToday = useCallback(() => {
    setSelectedDate(reportDate);
    setDetailDate(reportDate);
  }, [reportDate]);

  const handleSelectDate = useCallback((jsDate) => {
    if (!jsDate) return;
    const dateStr = format(jsDate, 'yyyy-MM-dd');
    // Block future dates
    if (dateStr > reportDate) return;
    setSelectedDate(dateStr);
    setDetailDate(dateStr);
    setCalendarOpen(false);
  }, [reportDate]);

  const handleDeptSelect = (val) => {
    setSelectedDeptId(val);
    localStorage.setItem('lastSelectedDept', val);
  };

  const handleFieldChange = (date, field, value) => {
    const isStringField = field === 'shiftName';
    const finalValue = isStringField ? value : (value === '' ? 0 : parseInt(value, 10) || 0);

    updateMonthReports((prev) => {
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

  const handleDiseaseChange = (date, diseaseName, field, value) => {
    let finalValue = value;
    if (field !== 'diseaseName') {
        finalValue = value === '' ? 0 : parseInt(value, 10) || 0;
    }

    updateMonthReports((prev) => {
      const newState = { ...prev };
      const prevReport = newState[date] || {};
      const newInfectious = [...(prevReport.infectiousData || [])];
      
      let idx = newInfectious.findIndex(d => d.diseaseName === diseaseName);
      if (idx === -1) {
          newInfectious.push({
             diseaseName: diseaseName,
             bnCu: 0, vaoVien: 0, chuyenDen: 0, chuyenDi: 0,
             raVien: 0, tuVong: 0, chuyenVien: 0, bnHienTai: 0
          });
          idx = newInfectious.length - 1;
      }
      
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
    updateMonthReports((prev) => {
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
    updateMonthReports((prev) => {
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
    // Use ref to get latest state (avoids stale closure after setMonthReports)
    const report = monthReportsRef.current[date];
    if (!report || !canEdit(report, date)) return;

    // Block save if BN hiện tại is negative
    const { valid } = validateReportRow(report);
    if (!valid) return;

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
          deathCases: (report.deathCases || []).filter(c => c && Object.keys(c).length > 0),
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

    // Block save if BN hiện tại is negative
    const { valid, errors } = validateReportRow(report);
    if (!valid) {
      showToast(errors[0], 'error');
      return;
    }

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
          deathCases: (report.deathCases || []).filter(c => c && Object.keys(c).length > 0),
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
      updateMonthReports(reportsDict);
      
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

    // Check for invalid rows  
    const invalidDays = editableDays.filter(dateStr => {
      const report = monthReports[dateStr];
      return report && !validateReportRow(report).valid;
    });
    if (invalidDays.length > 0) {
      showToast(`Có ${invalidDays.length} ngày có BN hiện tại âm. Vui lòng sửa trước khi lưu.`, 'error');
      return;
    }

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
            deathCases: (report.deathCases || []).filter(c => c && Object.keys(c).length > 0),
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
      updateMonthReports(reportsDict);
      
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
    const explicitlyUnlocked = report.status === REPORT_STATUS.UNLOCKED;
    const autoLocked = settings?.autoLockEnabled && shouldAutoLock(dateStr, settings.autoLockHour) && !explicitlyUnlocked;
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
          {/* Date Navigation Controls */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-0.5 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-900" onClick={handlePrevMonth} title="Tháng trước">
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-8 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 gap-1.5">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  <span className="capitalize">
                    {selectedDate ? (() => {
                      const d = parse(selectedDate, 'yyyy-MM-dd', new Date());
                      return `Tháng ${format(d, 'MM/yyyy')}`;
                    })() : '—'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate ? parse(selectedDate, 'yyyy-MM-dd', new Date()) : undefined}
                  onSelect={handleSelectDate}
                  disabled={(date) => date > parse(reportDate, 'yyyy-MM-dd', new Date())}
                  defaultMonth={selectedDate ? parse(selectedDate, 'yyyy-MM-dd', new Date()) : new Date()}
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:text-slate-900 disabled:opacity-30"
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-sm border-blue-200 text-blue-700 hover:bg-blue-50 gap-1.5 disabled:opacity-40"
            onClick={handleGoToday}
            disabled={selectedDate === reportDate}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hôm nay
          </Button>

          <Button 
            onClick={handleSaveAll}
            disabled={Object.values(saving).some(s => s) || !daysInMonth.some(d => canEdit(monthReports[d], d))}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Lưu tất cả
          </Button>
        </div>
      </div>

      <Tabs defaultValue="kcb" className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-4 pt-2">
          <TabsList className="h-10 bg-slate-100 p-1">
            <TabsTrigger value="kcb" className="text-sm px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white">📋 Số liệu KCB</TabsTrigger>
            <TabsTrigger value="btn" className="text-sm px-4 data-[state=active]:bg-teal-600 data-[state=active]:text-white">🦠 Bệnh truyền nhiễm</TabsTrigger>
            <TabsTrigger value="tv" className="text-sm px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white">💀 Bệnh nhân tử vong</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="kcb" className="flex-1 overflow-hidden mt-0">
          <Card className="h-full overflow-hidden shadow-sm border-slate-200 flex flex-col bg-white border-t-0 rounded-t-none">
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
                    <th className="w-10 px-1 py-3 border-r border-blue-500 text-center sticky left-0 z-30 bg-blue-600" />
                    <th className="px-3 py-3 font-semibold border-r border-blue-500 sticky left-[40px] z-30 bg-blue-600 min-w-[100px] shadow-[1px_0_0_0_#3b82f6]">Ngày</th>
                    <th className="px-3 py-3 font-semibold border-r border-blue-500 min-w-[120px] text-left">Tua trực</th>
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
                    const explicitlyUnlocked = report.status === REPORT_STATUS.UNLOCKED;
                    const autoLocked = settings?.autoLockEnabled && shouldAutoLock(dateStr, settings.autoLockHour) && !explicitlyUnlocked;
                    const isLocked = explicitlyLocked || autoLocked;
                    const editable = canEdit(report, dateStr);
                    const filledDeathRows = getFilledDeathRowsCount(dateStr);
                    const tuVongVal = report.tuVong || 0;
                    const isDeathWarning = tuVongVal > filledDeathRows;
                    const isSelectedDateRow = dateStr === selectedDate;
                    const rowClass = editable ? 'bg-yellow-50/50 group hover:bg-yellow-100/50 focus-within:bg-blue-100 focus-within:hover:bg-blue-100 transition-colors' : 'bg-slate-50 text-slate-500';

                    return (
                      <tr
                        key={dateStr}
                        ref={isSelectedDateRow ? selectedDateRowRef : null}
                        onClick={() => setDetailDate(dateStr)}
                        className={`${rowClass} border-b border-slate-200 cursor-pointer ${detailDate === dateStr ? 'bg-blue-50/30' : ''} ${isSelectedDateRow ? '!bg-blue-50/60' : ''}`}
                        style={isSelectedDateRow ? { boxShadow: 'inset 3px 0 0 0 #3b82f6' } : {}}
                      >
                        <td className={`w-10 px-1 py-2 border-r border-slate-100 text-center sticky left-0 z-10 ${editable ? (detailDate === dateStr ? 'bg-blue-50 shadow-[inset_2px_0_0_0_#60a5fa,inset_0_2px_0_0_#60a5fa,inset_0_-2px_0_0_#60a5fa]' : 'bg-[#fffbeb] group-hover:bg-[#fef3c7] group-focus-within:bg-blue-100') : 'bg-slate-50'}`}>
                          <div className={`mx-auto flex items-center justify-center w-6 h-6 rounded-sm transition-colors ${explicitlyLocked ? 'text-slate-400' : autoLocked ? 'text-orange-400' : 'text-blue-400'}`} title={explicitlyLocked ? "Đã khóa (Thủ công)" : autoLocked ? "Khóa tự động" : "Đang mở"}>
                            {explicitlyLocked || autoLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </div>
                        </td>
                        <td className={`px-3 py-2 font-medium border-r border-slate-200 sticky left-[40px] z-10 tabular-nums whitespace-nowrap text-slate-900 transition-colors ${editable ? (detailDate === dateStr ? 'bg-blue-50 shadow-[inset_0_2px_0_0_#60a5fa,inset_0_-2px_0_0_#60a5fa,1px_0_0_0_#e2e8f0]' : 'bg-[#fffbeb] group-hover:bg-[#fef3c7] group-focus-within:bg-blue-100 group-focus-within:hover:bg-blue-100 shadow-[1px_0_0_0_#e2e8f0]') : 'bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]'}`}>
                          <div className="flex items-center gap-1.5 justify-between">
                            <span>{formatDisplayDate(dateStr)}</span>
                            {isDeathWarning && (
                              <div title={`Bạn chưa nhập đủ danh sách bệnh nhân tử vong (thiếu ${tuVongVal - filledDeathRows} ca)`} className="inline-flex shrink-0">
                                <AlertCircle className="w-4 h-4 text-red-500 animate-[pulse_1.5s_ease-in-out_infinite]" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={`px-2 py-1 border-r border-slate-100 align-middle ${editable ? (detailDate === dateStr ? 'bg-blue-50 shadow-[inset_0_2px_0_0_#60a5fa,inset_0_-2px_0_0_#60a5fa]' : 'bg-[#fffbeb] group-hover:bg-[#fef3c7] group-focus-within:bg-blue-100 group-focus-within:hover:bg-blue-100') : 'bg-slate-50'}`}>
                          {editable ? (
                            <div className="relative group-focus-within:z-10 w-full min-w-[110px]">
                              <input
                                type="text"
                                aria-label={`Nhập tua trực ngày ${formatDisplayDate(dateStr)}`}
                                className="w-full h-8 px-2 bg-white border border-slate-300 rounded-md shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900 text-sm font-medium"
                                value={report.shiftName ?? ''}
                                placeholder="Ghi tên tua..."
                                onChange={(e) => handleFieldChange(dateStr, 'shiftName', e.target.value)}
                                onBlur={() => handleAutoSaveRow(dateStr)}
                                onKeyDown={handleKeyDown}
                              />
                            </div>
                          ) : (
                            <span className="block min-w-[110px] text-slate-600 truncate text-sm px-1 font-medium" title={report.shiftName || ''}>
                              {report.shiftName || '—'}
                            </span>
                          )}
                        </td>
                        {(() => {
                          const rowInvalid = (report.bnHienTai ?? 0) < 0;
                          return INPATIENT_FIELDS.map((field) => {
                            const isNegativeComputed = field.key === 'bnHienTai' && rowInvalid;
                            return (
                              <td
                                key={field.key}
                                className={`px-1 py-1 border-r border-slate-100 text-center align-middle relative ${detailDate === dateStr ? 'bg-blue-50/30' : ''} ${field.computed ? (isNegativeComputed ? 'bg-red-50 font-semibold text-red-600' : 'bg-black/[0.02] font-semibold text-slate-700') : ''}`}
                                style={detailDate === dateStr ? { boxShadow: 'inset 0 2px 0 0 #60a5fa, inset 0 -2px 0 0 #60a5fa' } : {}}
                              >
                                {field.editable && editable ? (
                                  <div className="relative group-focus-within:z-10 mx-auto w-16">
                                    <input
                                      type="number"
                                      min={field.key === 'tuVong' ? filledDeathRows : "0"}
                                      aria-label={`Nhập ${field.label} ngày ${formatDisplayDate(dateStr)}`}
                                      className={`w-full h-8 px-1 text-center border rounded-md shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all tabular-nums font-medium ${field.key === 'tuVong' && isDeathWarning ? 'bg-red-100 border-red-400 text-red-800' : field.key === 'tuVong' && tuVongVal > 0 && filledDeathRows >= tuVongVal ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-white border-slate-300 text-slate-900'}`}
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
                                  <span className={`block mx-auto min-w-[2rem] ${isNegativeComputed ? 'text-red-600 font-bold' : ''}`}>
                                    {report[field.key] ?? 0}
                                    {isNegativeComputed && ' ⚠️'}
                                  </span>
                                )}
                              </td>
                            );
                          });
                        })()}
                        <td 
                          className={`px-2 py-2 text-center align-middle relative ${detailDate === dateStr ? 'bg-blue-50/30' : ''}`}
                          style={detailDate === dateStr ? { boxShadow: 'inset -2px 0 0 0 #60a5fa, inset 0 2px 0 0 #60a5fa, inset 0 -2px 0 0 #60a5fa' } : {}}
                        >
                          {editable ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className={`h-8 w-8 p-0 shadow-sm border transition-all ${(report.bnHienTai ?? 0) < 0 ? 'text-red-400 bg-red-50 border-red-200 cursor-not-allowed opacity-50' : 'text-blue-600 bg-white hover:bg-blue-600 hover:text-white border-slate-300 group-hover:border-blue-200'}`}
                              onClick={() => handleSaveRow(dateStr)}
                              disabled={saving[dateStr] || (report.bnHienTai ?? 0) < 0}
                              title={(report.bnHienTai ?? 0) < 0 ? 'Không thể lưu: BN hiện tại âm' : 'Lưu dòng này'}
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
                    <td className="px-3 py-4 border-r border-blue-200 bg-blue-100"></td>
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
        </TabsContent>

        <TabsContent value="btn" className="flex-1 overflow-hidden mt-0">
          <Card className="h-full overflow-hidden shadow-sm border-slate-200 flex flex-col bg-white border-t-0 rounded-t-none">
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col h-full relative">
              <InfectiousEntryTab
                monthReports={monthReports}
                daysInMonth={daysInMonth}
                detailDate={detailDate}
                diseaseCatalog={diseaseCatalog}
                settings={settings}
                canEdit={canEdit}
                onDiseaseChange={handleDiseaseChange}
                onAddDisease={handleAddDisease}
                onRemoveDisease={handleRemoveDisease}
                onAutoSave={handleAutoSaveRow}
                onKeyDown={handleKeyDown}
                dataLoading={dataLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tv" className="flex-1 overflow-hidden mt-0">
          <Card className="h-full overflow-hidden shadow-sm border-slate-200 flex flex-col bg-white border-t-0 rounded-t-none">
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col h-full relative">
              <DeathReportTab
                monthReports={monthReports}
                setMonthReports={updateMonthReports}
                detailDate={detailDate}
                selectedDeptId={selectedDeptId}
                settings={settings}
                handleAutoSaveRow={handleAutoSaveRow}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
