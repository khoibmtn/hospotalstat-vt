import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getReportsByDateRange, lockReportsBatch, unlockReportsBatch, unlockReport, lockReport } from '../services/reportService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { getSettings, updateSettings } from '../services/settingsService';
import { formatDisplayDate } from '../utils/dateUtils';
import { REPORT_STATUS } from '../utils/constants';
import { format, parse, subDays, startOfMonth, subMonths, endOfMonth, differenceInCalendarDays } from 'date-fns';
import { vi } from 'date-fns/locale';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Loader2, Lock, Unlock, Calendar as CalendarIcon, Clock,
  ShieldCheck, CheckSquare, Square, MinusSquare,
  ChevronDown, ChevronRight, AlertTriangle,
  ChevronsUpDown, Building2, XCircle,
} from 'lucide-react';

// ─── DateTreeNode ──────────────────────────────────────
function DateTreeNode({ date, reports, lockedCount, openCount, onUnlock, onLock, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => { setExpanded(defaultExpanded); }, [defaultExpanded]);
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left cursor-pointer"
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        }
        <span className="text-xs font-bold text-slate-700">{formatDisplayDate(date)}</span>
        <span className="ml-auto flex items-center gap-2 text-[10px]">
          {openCount > 0 && <span className="text-emerald-600 font-semibold">{openCount} mở</span>}
          {lockedCount > 0 && <span className="text-red-500 font-semibold">{lockedCount} khóa</span>}
        </span>
      </button>
      {expanded && (
        <div className="divide-y divide-slate-100">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 pl-8 hover:bg-slate-50/80 transition-colors">
              {r.status === REPORT_STATUS.LOCKED
                ? <Lock className="w-3 h-3 text-red-400 shrink-0" />
                : <Unlock className="w-3 h-3 text-emerald-400 shrink-0" />
              }
              <span className="text-xs text-slate-800 font-medium flex-1 truncate">{r.departmentName}</span>
              {r.lockedBy && <span className="text-[10px] text-slate-400 hidden sm:block">{r.lockedBy}</span>}
              {r.status === REPORT_STATUS.LOCKED ? (
                <button
                  onClick={() => onUnlock(r.id, r.departmentName)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium px-1.5 py-0.5 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  Mở khóa
                </button>
              ) : (
                <button
                  onClick={() => onLock(r.id, r.departmentName)}
                  className="text-[10px] text-red-500 hover:text-red-700 font-medium px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Khóa
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DeptTreeView ──────────────────────────────────────
function DeptTreeView({ facilities, departments, selectedDeptIds, onToggleDept, onToggleFacility, onSelectAll, onDeselectAll }) {
  const [expandedFacs, setExpandedFacs] = useState(() => new Set(facilities.map((f) => f.id)));

  const allIds = departments.map((d) => d.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedDeptIds.includes(id));
  const noneSelected = allIds.every((id) => !selectedDeptIds.includes(id));
  const allState = allSelected ? 'all' : noneSelected ? 'none' : 'partial';

  function toggleFacExpand(facId) {
    setExpandedFacs((prev) => {
      const next = new Set(prev);
      next.has(facId) ? next.delete(facId) : next.add(facId);
      return next;
    });
  }

  return (
    <div className="space-y-0.5">
      {/* Toàn viện */}
      <button
        onClick={() => allSelected ? onDeselectAll() : onSelectAll()}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 transition-colors text-left cursor-pointer"
      >
        {allState === 'all'
          ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
          : allState === 'partial'
            ? <MinusSquare className="w-4 h-4 text-amber-500 shrink-0" />
            : <Square className="w-4 h-4 text-slate-400 shrink-0" />
        }
        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800">Toàn viện</span>
        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
          {selectedDeptIds.length}/{allIds.length}
        </Badge>
      </button>

      {/* Facilities */}
      {facilities.map((f) => {
        const facDepts = departments.filter((d) => d.facilityId === f.id);
        if (facDepts.length === 0) return null;
        const selCount = facDepts.filter((d) => selectedDeptIds.includes(d.id)).length;
        const facState = selCount === 0 ? 'none' : selCount === facDepts.length ? 'all' : 'partial';
        const isExpanded = expandedFacs.has(f.id);

        return (
          <div key={f.id}>
            <div className="flex items-center gap-1 pl-4">
              <button
                onClick={() => toggleFacExpand(f.id)}
                className="p-0.5 hover:bg-slate-200 rounded transition-colors cursor-pointer"
              >
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                }
              </button>
              <button
                onClick={() => onToggleFacility(f.id)}
                className="flex-1 flex items-center gap-1.5 py-1.5 px-1 rounded-md hover:bg-slate-100 transition-colors text-left cursor-pointer"
              >
                {facState === 'all'
                  ? <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  : facState === 'partial'
                    ? <MinusSquare className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    : <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                }
                <span className="text-xs font-semibold text-slate-700 uppercase">{f.name}</span>
                <span className="text-[10px] text-slate-400 ml-auto">{selCount}/{facDepts.length}</span>
              </button>
            </div>

            {/* Departments under facility */}
            {isExpanded && (
              <div className="ml-6 space-y-0">
                {facDepts.map((d) => {
                  const sel = selectedDeptIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => onToggleDept(d.id)}
                      className="w-full flex items-center gap-2 pl-6 pr-2 py-1 rounded hover:bg-slate-100 transition-colors text-left cursor-pointer"
                    >
                      {sel
                        ? <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        : <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      }
                      <span className={`text-xs ${sel ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{d.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Deselect all */}
      {selectedDeptIds.length > 0 && (
        <button
          onClick={onDeselectAll}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 mt-1 ml-2 transition-colors cursor-pointer"
        >
          <XCircle className="w-3 h-3" />
          Bỏ chọn tất cả
        </button>
      )}
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 overflow-hidden animate-pulse">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50">
            <div className="w-3.5 h-3.5 bg-slate-200 rounded" />
            <div className="h-3.5 bg-slate-200 rounded w-24" />
            <div className="ml-auto flex gap-2">
              <div className="h-3 bg-slate-200 rounded w-10" />
              <div className="h-3 bg-slate-200 rounded w-10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const DATE_FMT = 'yyyy-MM-dd';

export default function LockManagementPage() {
  const { user } = useAuth();
  const today = format(new Date(), DATE_FMT);

  // Filters
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);

  // Data
  const [departments, setDepartments] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [reports, setReports] = useState([]);
  const [settings, setSettingsState] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // UI state
  const [toast, setToast] = useState(null);
  const [showAutoLock, setShowAutoLock] = useState(false);
  const [showDetailMobile, setShowDetailMobile] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [allExpanded, setAllExpanded] = useState(false);

  const fetchRef = useRef(0);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  // Load config
  useEffect(() => {
    async function loadConfig() {
      const [facs, depts, sets] = await Promise.all([getFacilities(), getDepartments(), getSettings()]);
      setFacilities(facs);
      setDepartments(depts);
      setSettingsState(sets);
      // Default: select all
      setSelectedDeptIds(depts.map((d) => d.id));
    }
    loadConfig();
  }, []);

  // Auto-fetch
  const fetchData = useCallback(async () => {
    if (!startDate || !endDate || endDate < startDate) return;
    const id = ++fetchRef.current;
    setLoading(true);
    try {
      const reps = await getReportsByDateRange(startDate, endDate);
      if (id === fetchRef.current) setReports(reps);
    } catch (err) {
      console.error(err);
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered reports
  const filteredReports = useMemo(
    () => reports.filter((r) => selectedDeptIds.includes(r.departmentId)),
    [reports, selectedDeptIds]
  );

  const lockableCount = filteredReports.filter((r) => r.status === REPORT_STATUS.OPEN).length;
  const unlockableCount = filteredReports.filter((r) => r.status === REPORT_STATUS.LOCKED).length;
  const nothingToDo = lockableCount === 0 && unlockableCount === 0 && !loading;
  const dayCount = differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1;

  // Dept toggle
  function toggleDept(deptId) {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  }
  function toggleFacility(facilityId) {
    const ids = departments.filter((d) => d.facilityId === facilityId).map((d) => d.id);
    const allSel = ids.every((id) => selectedDeptIds.includes(id));
    setSelectedDeptIds((prev) => allSel ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  }
  function selectAll() { setSelectedDeptIds(departments.map((d) => d.id)); }
  function deselectAll() { setSelectedDeptIds([]); }

  // Get dept names for confirm dialog
  function getSelectedDeptNames() {
    if (selectedDeptIds.length === departments.length) return ['Tất cả khoa'];
    return departments.filter((d) => selectedDeptIds.includes(d.id)).map((d) => d.name);
  }

  // Confirm → Execute
  function requestLock() {
    if (selectedDeptIds.length === 0) return showToast('Chọn ít nhất 1 khoa', 'error');
    setConfirmAction({
      type: 'lock',
      count: lockableCount,
      deptNames: getSelectedDeptNames(),
      start: formatDisplayDate(startDate),
      end: formatDisplayDate(endDate),
    });
  }
  function requestUnlock() {
    if (selectedDeptIds.length === 0) return showToast('Chọn ít nhất 1 khoa', 'error');
    setConfirmAction({
      type: 'unlock',
      count: unlockableCount,
      deptNames: getSelectedDeptNames(),
      start: formatDisplayDate(startDate),
      end: formatDisplayDate(endDate),
    });
  }

  async function executeConfirmed() {
    if (!confirmAction) return;
    setActionLoading(true);
    setConfirmAction(null);
    try {
      const lockedBy = user?.nickname || user?.displayName || 'Admin';
      if (confirmAction.type === 'lock') {
        await lockReportsBatch(startDate, endDate, selectedDeptIds, lockedBy);
        showToast(`Đã khóa ${confirmAction.count} báo cáo`);
      } else {
        await unlockReportsBatch(startDate, endDate, selectedDeptIds);
        showToast(`Đã mở khóa ${confirmAction.count} báo cáo`);
      }
      await fetchData();
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnlockSingle(reportId, deptName) {
    try {
      await unlockReport(reportId);
      showToast(`Đã mở khóa ${deptName}`);
      await fetchData();
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  }

  async function handleLockSingle(reportId, deptName) {
    try {
      await lockReport(reportId, user?.nickname || user?.displayName || 'Admin');
      showToast(`Đã khóa ${deptName}`);
      await fetchData();
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  }

  // Auto-lock settings
  async function handleToggleAutoLock(checked) {
    await updateSettings({ autoLockEnabled: checked });
    setSettingsState((prev) => ({ ...prev, autoLockEnabled: checked }));
    showToast(`Khóa tự động: ${checked ? 'BẬT' : 'TẮT'}`);
  }
  async function handleAutoLockHourChange(value) {
    const hour = parseInt(value, 10);
    await updateSettings({ autoLockHour: hour });
    setSettingsState((prev) => ({ ...prev, autoLockHour: hour }));
    showToast(`Giờ khóa tự động: ${hour}h`);
  }

  // Date helpers
  function handleStartDateChange(val) {
    setStartDate(val);
    if (endDate < val) setEndDate(val);
  }
  function handleEndDateChange(val) {
    if (val < startDate) return;
    setEndDate(val);
  }

  // Group for detail tree
  const reportsByDate = useMemo(() => {
    const map = {};
    filteredReports
      .sort((a, b) => a.date.localeCompare(b.date) || (a.departmentName || '').localeCompare(b.departmentName || ''))
      .forEach((r) => { if (!map[r.date]) map[r.date] = []; map[r.date].push(r); });
    return Object.entries(map);
  }, [filteredReports]);

  if (departments.length === 0 && Object.keys(settings).length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ─── Detail Panel (reusable for desktop & mobile) ───
  const detailPanel = (
    <>
      {loading ? (
        <DetailSkeleton />
      ) : reportsByDate.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <CalendarIcon className="w-10 h-10 mb-3 text-slate-300" />
          <p className="text-sm font-medium">Không có báo cáo trong khoảng thời gian này</p>
          <p className="text-xs mt-1">Thay đổi ngày hoặc phạm vi khoa để xem dữ liệu</p>
        </div>
      ) : (
        <div className="space-y-1">
          {reportsByDate.map(([date, dateReports]) => {
            const dateLocked = dateReports.filter((r) => r.status === REPORT_STATUS.LOCKED).length;
            const dateOpen = dateReports.length - dateLocked;
            return (
              <DateTreeNode
                key={date}
                date={date}
                reports={dateReports}
                lockedCount={dateLocked}
                openCount={dateOpen}
                onUnlock={handleUnlockSingle}
                onLock={handleLockSingle}
                defaultExpanded={allExpanded}
              />
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 pb-24 overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 md:mb-5 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
          Quản lý khóa số liệu
        </h1>
      </div>

      {/* 2-column grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">

          {/* Auto-lock — collapsible */}
          <Card className="shadow-sm border-slate-200">
            <button
              onClick={() => setShowAutoLock(!showAutoLock)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 font-semibold text-sm text-slate-700">
                <Clock className="w-4 h-4 text-indigo-500" />
                Cài đặt khóa tự động
                {settings.autoLockEnabled && (
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] px-1.5 py-0">BẬT</Badge>
                )}
              </span>
              {showAutoLock ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {showAutoLock && (
              <CardContent className="px-4 pb-4 pt-0 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 mt-3">
                  <div className="flex items-center space-x-2">
                    <Switch id="auto-lock" checked={settings.autoLockEnabled || false} onCheckedChange={handleToggleAutoLock} className="data-[state=checked]:bg-indigo-600" />
                    <Label htmlFor="auto-lock" className="font-medium cursor-pointer text-slate-700 text-sm">Bật khóa tự động</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-slate-600">Giờ khóa:</Label>
                    <Select value={(settings.autoLockHour ?? 8).toString()} onValueChange={handleAutoLockHourChange} disabled={!settings.autoLockEnabled}>
                      <SelectTrigger className="h-8 w-20 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}:00</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Date range */}
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 space-y-3">
              <Label className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" /> Khoảng thời gian
              </Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-9 justify-start text-left font-normal text-sm cursor-pointer">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                        {formatDisplayDate(startDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parse(startDate, DATE_FMT, new Date())}
                        onSelect={(d) => d && handleStartDateChange(format(d, DATE_FMT))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-slate-400 text-sm shrink-0">→</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-9 justify-start text-left font-normal text-sm cursor-pointer">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                        {formatDisplayDate(endDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parse(endDate, DATE_FMT, new Date())}
                        onSelect={(d) => d && handleEndDateChange(format(d, DATE_FMT))}
                        disabled={(d) => d < parse(startDate, DATE_FMT, new Date())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 cursor-pointer" onClick={() => { setStartDate(today); setEndDate(today); }}>Hôm nay</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 cursor-pointer" onClick={() => { setStartDate(format(subDays(new Date(), 1), DATE_FMT)); setEndDate(format(subDays(new Date(), 1), DATE_FMT)); }}>Hôm qua</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 cursor-pointer" onClick={() => { setStartDate(format(subDays(new Date(), 6), DATE_FMT)); setEndDate(today); }}>7 ngày</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 cursor-pointer" onClick={() => { setStartDate(format(startOfMonth(new Date()), DATE_FMT)); setEndDate(today); }}>Tháng này</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 cursor-pointer" onClick={() => { const prev = subMonths(new Date(), 1); setStartDate(format(startOfMonth(prev), DATE_FMT)); setEndDate(format(endOfMonth(prev), DATE_FMT)); }}>Tháng trước</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dept treeview */}
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 space-y-2">
              <Label className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Phạm vi
              </Label>
              <div className="max-h-[240px] overflow-y-auto">
                <DeptTreeView
                  facilities={facilities}
                  departments={departments}
                  selectedDeptIds={selectedDeptIds}
                  onToggleDept={toggleDept}
                  onToggleFacility={toggleFacility}
                  onSelectAll={selectAll}
                  onDeselectAll={deselectAll}
                />
              </div>
            </CardContent>
          </Card>

          {/* Mobile summary + CTAs */}
          <div className="lg:hidden">
            <Card className="shadow-sm border-slate-200">
              <CardContent className="p-4 space-y-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1">
                  <p className="text-xs text-slate-500">
                    <strong className="text-slate-700">{selectedDeptIds.length}</strong> khoa ·{' '}
                    <strong className="text-slate-700">{dayCount > 0 ? dayCount : 0}</strong> ngày →{' '}
                    <strong className="text-slate-800">{filteredReports.length}</strong> báo cáo
                  </p>
                  {!loading && filteredReports.length > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      {lockableCount > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Unlock className="w-3 h-3" /> <strong>{lockableCount}</strong> mở
                        </span>
                      )}
                      {unlockableCount > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <Lock className="w-3 h-3" /> <strong>{unlockableCount}</strong> khóa
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-2 text-slate-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Đang tính toán...
                  </div>
                ) : nothingToDo ? (
                  <div className="text-center text-slate-400 text-xs py-1">
                    Không có báo cáo nào cần thao tác
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {lockableCount > 0 && (
                      <Button variant="destructive" className="w-full h-10 shadow-sm text-sm font-semibold cursor-pointer" disabled={actionLoading || loading} onClick={requestLock}>
                        {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                        Khóa {lockableCount} báo cáo
                      </Button>
                    )}
                    {unlockableCount > 0 && (
                      <Button variant="outline" className="w-full h-10 shadow-sm text-sm font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer" disabled={actionLoading || loading} onClick={requestUnlock}>
                        {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />}
                        Mở khóa {unlockableCount} báo cáo
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mobile detail toggle */}
          <div className="lg:hidden">
            <Card className="shadow-sm border-slate-200">
              <button
                onClick={() => setShowDetailMobile(!showDetailMobile)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold text-sm text-slate-700">
                  <CalendarIcon className="w-4 h-4 text-blue-500" />
                  Xem chi tiết báo cáo
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{filteredReports.length}</Badge>
                </span>
                {showDetailMobile ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              {showDetailMobile && (
                <CardContent className="px-3 pb-3 pt-0 border-t border-slate-100">
                  <div className="flex items-center justify-end gap-1 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] text-slate-500 px-2 cursor-pointer"
                      onClick={() => setAllExpanded(!allExpanded)}
                    >
                      <ChevronsUpDown className="w-3 h-3 mr-1" />
                      {allExpanded ? 'Thu gọn tất cả' : 'Bung tất cả'}
                    </Button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto space-y-1">
                    {detailPanel}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN (desktop only) ═══ */}
        <div className="hidden lg:flex lg:flex-col lg:gap-3">
          {/* Selection summary + CTAs */}
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 space-y-3">
              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1">
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-700">{selectedDeptIds.length}</strong> khoa ·{' '}
                  <strong className="text-slate-700">{dayCount > 0 ? dayCount : 0}</strong> ngày →{' '}
                  <strong className="text-slate-800">{filteredReports.length}</strong> báo cáo
                </p>
                {!loading && filteredReports.length > 0 && (
                  <div className="flex items-center gap-3 text-xs">
                    {lockableCount > 0 && (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Unlock className="w-3 h-3" /> <strong>{lockableCount}</strong> mở
                      </span>
                    )}
                    {unlockableCount > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <Lock className="w-3 h-3" /> <strong>{unlockableCount}</strong> khóa
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* CTAs */}
              {loading ? (
                <div className="flex items-center justify-center py-2 text-slate-400 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Đang tính toán...
                </div>
              ) : nothingToDo ? (
                <div className="text-center text-slate-400 text-xs py-1">
                  Không có báo cáo nào cần thao tác
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {lockableCount > 0 && (
                    <Button
                      variant="destructive"
                      className="h-10 px-5 shadow-sm text-sm font-semibold cursor-pointer"
                      disabled={actionLoading || loading}
                      onClick={requestLock}
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                      Khóa {lockableCount} báo cáo
                    </Button>
                  )}
                  {unlockableCount > 0 && (
                    <Button
                      variant="outline"
                      className="h-10 px-5 shadow-sm text-sm font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      disabled={actionLoading || loading}
                      onClick={requestUnlock}
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />}
                      Mở khóa {unlockableCount} báo cáo
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="flex items-center gap-2 font-semibold text-sm text-slate-700">
                <CalendarIcon className="w-4 h-4 text-blue-500" />
                Chi tiết báo cáo
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{filteredReports.length}</Badge>
              </span>
              {reportsByDate.length > 0 && !loading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-slate-500 px-2 cursor-pointer"
                  onClick={() => setAllExpanded(!allExpanded)}
                >
                  <ChevronsUpDown className="w-3 h-3 mr-1" />
                  {allExpanded ? 'Thu gọn tất cả' : 'Bung tất cả'}
                </Button>
              )}
            </div>
            <CardContent className="px-3 pb-3 pt-3">
              {detailPanel}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirm dialog overlay */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-full ${confirmAction.type === 'lock' ? 'bg-red-100' : 'bg-emerald-100'}`}>
                {confirmAction.type === 'lock'
                  ? <Lock className="w-5 h-5 text-red-600" />
                  : <Unlock className="w-5 h-5 text-emerald-600" />
                }
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {confirmAction.type === 'lock' ? 'Xác nhận khóa' : 'Xác nhận mở khóa'}
              </h3>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm border border-slate-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-slate-700">
                  Bạn sắp <strong>{confirmAction.type === 'lock' ? 'KHÓA' : 'MỞ KHÓA'}</strong>{' '}
                  <strong className={confirmAction.type === 'lock' ? 'text-red-600' : 'text-emerald-600'}>
                    {confirmAction.count} báo cáo
                  </strong>
                </span>
              </div>
              <div className="ml-6 space-y-1 text-slate-500 text-xs">
                <p>Thời gian: <strong>{confirmAction.start} → {confirmAction.end}</strong></p>
                <p>Phạm vi: <strong>{confirmAction.deptNames.length <= 3
                  ? confirmAction.deptNames.join(', ')
                  : `${confirmAction.deptNames.length} khoa`
                }</strong></p>
              </div>
            </div>

            <div className="flex gap-3 mt-5 justify-end">
              <Button variant="outline" size="sm" className="h-9 cursor-pointer" onClick={() => setConfirmAction(null)}>
                Hủy
              </Button>
              <Button
                size="sm"
                className={`h-9 font-semibold cursor-pointer ${confirmAction.type === 'lock' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                onClick={executeConfirmed}
              >
                {confirmAction.type === 'lock' ? <Lock className="w-3.5 h-3.5 mr-1.5" /> : <Unlock className="w-3.5 h-3.5 mr-1.5" />}
                Xác nhận {confirmAction.type === 'lock' ? 'khóa' : 'mở khóa'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg bg-slate-800 text-white animate-in slide-in-from-bottom-5 max-w-sm">
          <ShieldCheck className={`w-4 h-4 shrink-0 ${toast.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`} />
          <span className="text-sm font-medium">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white text-xs shrink-0 cursor-pointer">✕</button>
        </div>
      )}
    </div>
  );
}
