import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getReportsByDateRange, lockReportsBatch, unlockReportsBatch, unlockReport } from '../services/reportService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { getSettings, updateSettings } from '../services/settingsService';
import { formatDisplayDate, getToday } from '../utils/dateUtils';
import { REPORT_STATUS } from '../utils/constants';
import { format, subDays, startOfMonth, subMonths, endOfMonth } from 'date-fns';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Loader2, Lock, Unlock, Calendar as CalendarIcon, Clock,
  ShieldCheck, CheckSquare, Square, MinusSquare,
  ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';

function DateTreeNode({ date, reports, lockedCount, openCount, onUnlock }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
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
              {r.status === REPORT_STATUS.LOCKED && (
                <button
                  onClick={() => onUnlock(r.id, r.departmentName)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium px-1.5 py-0.5 rounded hover:bg-emerald-50 transition-colors"
                >
                  Mở khóa
                </button>
              )}
            </div>
          ))}
        </div>
      )}
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
  const [deptScope, setDeptScope] = useState('all'); // 'all' | 'specific'
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
  const [showDetail, setShowDetail] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // null | { type: 'lock' | 'unlock', count, deptNames, start, end }

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

  // Effective dept IDs based on scope
  const effectiveDeptIds = useMemo(() => {
    if (deptScope === 'all') return departments.map((d) => d.id);
    return selectedDeptIds;
  }, [deptScope, selectedDeptIds, departments]);

  // Filtered reports
  const filteredReports = useMemo(
    () => reports.filter((r) => effectiveDeptIds.includes(r.departmentId)),
    [reports, effectiveDeptIds]
  );

  const lockableCount = filteredReports.filter((r) => r.status === REPORT_STATUS.OPEN).length;
  const unlockableCount = filteredReports.filter((r) => r.status === REPORT_STATUS.LOCKED).length;
  const nothingToDo = lockableCount === 0 && unlockableCount === 0 && !loading;

  // Dept selection
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

  // Get dept names for confirm dialog
  function getSelectedDeptNames() {
    if (deptScope === 'all') return ['Tất cả khoa'];
    return departments.filter((d) => effectiveDeptIds.includes(d.id)).map((d) => d.name);
  }

  // Confirm → Execute
  function requestLock() {
    if (effectiveDeptIds.length === 0) return showToast('Chọn ít nhất 1 khoa', 'error');
    setConfirmAction({
      type: 'lock',
      count: lockableCount,
      deptNames: getSelectedDeptNames(),
      start: formatDisplayDate(startDate),
      end: formatDisplayDate(endDate),
    });
  }
  function requestUnlock() {
    if (effectiveDeptIds.length === 0) return showToast('Chọn ít nhất 1 khoa', 'error');
    setConfirmAction({
      type: 'unlock',
      count: unlockableCount,
      deptNames: getSelectedDeptNames(),
      start: formatDisplayDate(startDate),
      end: formatDisplayDate(endDate),
    });
  }

  async function executeConfirmed() {
    const action = confirmAction;
    setConfirmAction(null);
    setActionLoading(true);
    try {
      if (action.type === 'lock') {
        const count = await lockReportsBatch(startDate, endDate, effectiveDeptIds, user.displayName);
        showToast(`✅ Đã khóa ${count} báo cáo (${action.start} → ${action.end})`);
      } else {
        const count = await unlockReportsBatch(startDate, endDate, effectiveDeptIds);
        showToast(`✅ Đã mở khóa ${count} báo cáo (${action.start} → ${action.end})`);
      }
      await fetchData();
    } catch (err) {
      showToast('❌ Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnlockSingle(reportId, deptName) {
    try {
      await unlockReport(reportId);
      showToast(`✅ Đã mở khóa ${deptName}`);
      await fetchData();
    } catch (err) {
      showToast('❌ Lỗi: ' + err.message, 'error');
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

  // Group for detail table
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

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 pb-24 overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 md:mb-5 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
          Quản lý khóa số liệu
        </h1>
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-4">
        {/* Auto-lock — collapsible */}
        <Card className="shadow-sm border-slate-200 shrink-0">
          <button
            onClick={() => setShowAutoLock(!showAutoLock)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
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

        {/* Main action card */}
        <Card className="shadow-sm border-slate-200 shrink-0">
          <CardContent className="p-4 bg-white space-y-4">
            {/* 1. Date range */}
            <div>
              <Label className="text-[11px] font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" /> Khoảng thời gian
              </Label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                <div className="flex-1 sm:flex-none sm:w-[150px]">
                  <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <span className="text-slate-400 text-sm self-center hidden sm:block">→</span>
                <div className="flex-1 sm:flex-none sm:w-[150px]">
                  <input type="date" value={endDate} min={startDate} onChange={(e) => handleEndDateChange(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => { setStartDate(today); setEndDate(today); }}>Hôm nay</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => { setStartDate(format(subDays(new Date(), 1), DATE_FMT)); setEndDate(format(subDays(new Date(), 1), DATE_FMT)); }}>Hôm qua</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => { setStartDate(format(subDays(new Date(), 6), DATE_FMT)); setEndDate(today); }}>7 ngày</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => { setStartDate(format(startOfMonth(new Date()), DATE_FMT)); setEndDate(today); }}>Tháng này</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => { const prev = subMonths(new Date(), 1); setStartDate(format(startOfMonth(prev), DATE_FMT)); setEndDate(format(endOfMonth(prev), DATE_FMT)); }}>Tháng trước</Button>
                </div>
              </div>
            </div>

            {/* 2. Department scope — radio + progressive disclosure */}
            <div>
              <Label className="text-[11px] font-semibold text-slate-500 uppercase mb-2 block">🏥 Phạm vi</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="radio" name="deptScope" checked={deptScope === 'all'} onChange={() => setDeptScope('all')} className="text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Tất cả khoa</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="radio" name="deptScope" checked={deptScope === 'specific'} onChange={() => { setDeptScope('specific'); if (selectedDeptIds.length === 0) setSelectedDeptIds(departments.map((d) => d.id)); }} className="text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Chọn cụ thể</span>
                </label>

                {/* Progressive disclosure */}
                {deptScope === 'specific' && (
                  <div className="ml-6 border border-slate-200 rounded-lg p-3 bg-slate-50/50 max-h-[180px] overflow-y-auto space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    {facilities.map((f) => {
                      const facDepts = departments.filter((d) => d.facilityId === f.id);
                      if (facDepts.length === 0) return null;
                      const selCount = facDepts.filter((d) => selectedDeptIds.includes(d.id)).length;
                      const state = selCount === 0 ? 'none' : selCount === facDepts.length ? 'all' : 'partial';
                      return (
                        <div key={f.id}>
                          <button onClick={() => toggleFacility(f.id)} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase hover:text-slate-900 mb-1">
                            {state === 'all' ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" /> : state === 'partial' ? <MinusSquare className="w-3.5 h-3.5 text-blue-500" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                            {f.name}
                          </button>
                          <div className="flex flex-wrap gap-1.5 ml-5">
                            {facDepts.map((d) => {
                              const sel = selectedDeptIds.includes(d.id);
                              return (
                                <button key={d.id} onClick={() => toggleDept(d.id)}
                                  className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${sel ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}>
                                  {sel ? '✓ ' : ''}{d.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Action zone */}
            <div className="border-t border-slate-100 pt-4">
              {loading ? (
                <div className="flex items-center justify-center py-4 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang tính toán...
                </div>
              ) : nothingToDo ? (
                <div className="text-center py-4 text-slate-400 text-sm">
                  📋 Không có báo cáo nào cần thao tác trong khoảng thời gian này
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Explanation text */}
                  <div className="text-xs text-slate-500 space-y-0.5">
                    {lockableCount > 0 && (
                      <p>🟢 <strong>{lockableCount}</strong> báo cáo đang <strong>mở</strong> → có thể khóa</p>
                    )}
                    {unlockableCount > 0 && (
                      <p>🔴 <strong>{unlockableCount}</strong> báo cáo đang <strong>khóa</strong> → có thể mở</p>
                    )}
                  </div>

                  {/* CTAs — only show relevant ones */}
                  <div className="flex flex-wrap gap-3">
                    {lockableCount > 0 && (
                      <Button
                        variant="destructive"
                        className="h-10 px-5 shadow-sm text-sm font-semibold"
                        disabled={actionLoading}
                        onClick={requestLock}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                        Khóa {lockableCount} báo cáo
                      </Button>
                    )}
                    {unlockableCount > 0 && (
                      <Button
                        variant="outline"
                        className="h-10 px-5 shadow-sm text-sm font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        disabled={actionLoading}
                        onClick={requestUnlock}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />}
                        Mở khóa {unlockableCount} báo cáo
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detail tree — collapsible */}
        <Card className="shadow-sm border-slate-200 shrink-0">
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2 font-semibold text-sm text-slate-700">
              📊 Xem chi tiết báo cáo
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{filteredReports.length}</Badge>
            </span>
            {showDetail ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>
          {showDetail && (
            <CardContent className="px-3 pb-3 pt-0 border-t border-slate-100 bg-white">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tải...
                </div>
              ) : reportsByDate.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Không có báo cáo</div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto mt-2 space-y-1">
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
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>
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
                <p>📅 Thời gian: <strong>{confirmAction.start} → {confirmAction.end}</strong></p>
                <p>🏥 Phạm vi: <strong>{confirmAction.deptNames.length <= 3
                  ? confirmAction.deptNames.join(', ')
                  : `${confirmAction.deptNames.length} khoa`
                }</strong></p>
              </div>
            </div>

            <div className="flex gap-3 mt-5 justify-end">
              <Button variant="outline" size="sm" className="h-9" onClick={() => setConfirmAction(null)}>
                Hủy
              </Button>
              <Button
                size="sm"
                className={`h-9 font-semibold ${confirmAction.type === 'lock' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                onClick={executeConfirmed}
              >
                {confirmAction.type === 'lock' ? <Lock className="w-3.5 h-3.5 mr-1.5" /> : <Unlock className="w-3.5 h-3.5 mr-1.5" />}
                Xác nhận
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
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white text-xs shrink-0">✕</button>
        </div>
      )}
    </div>
  );
}
