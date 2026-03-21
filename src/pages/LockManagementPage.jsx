import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getReportsByDate, lockReportsByDate, unlockReport } from '../services/reportService';
import { getSettings, updateSettings } from '../services/settingsService';
import { formatDisplayDate, getToday, getYesterday } from '../utils/dateUtils';
import { REPORT_STATUS, ROLES } from '../utils/constants';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Unlock, Calendar as CalendarIcon, Clock, ShieldCheck } from 'lucide-react';
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

  async function handleToggleAutoLock(checked) {
    const newValue = checked;
    await updateSettings({ autoLockEnabled: newValue });
    setSettingsState((prev) => ({ ...prev, autoLockEnabled: newValue }));
    showToast(`Khóa tự động: ${newValue ? 'BẬT' : 'TẮT'}`);
  }

  async function handleAutoLockHourChange(value) {
    const hour = parseInt(value, 10);
    await updateSettings({ autoLockHour: hour });
    setSettingsState((prev) => ({ ...prev, autoLockHour: hour }));
    showToast(`Giờ khóa tự động: ${hour}h`);
  }

  const lockedCount = reports.filter((r) => r.status === REPORT_STATUS.LOCKED).length;
  const openCount = reports.filter((r) => r.status === REPORT_STATUS.OPEN).length;

  if (loading && Object.keys(settings).length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-slate-500 animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-500" />
          <div className="font-medium">Đang tải cấu hình...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 pb-24 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            Quản lý khóa số liệu
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-6">
        {/* Auto-lock settings */}
        <Card className="shadow-sm border-slate-200 shrink-0">
          <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Cài đặt khóa tự động
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 bg-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="auto-lock" 
                  checked={settings.autoLockEnabled || false}
                  onCheckedChange={handleToggleAutoLock}
                  className="data-[state=checked]:bg-indigo-600"
                />
                <Label htmlFor="auto-lock" className="font-medium cursor-pointer text-slate-700">Bật khóa tự động hằng ngày</Label>
              </div>

              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium text-slate-600 whitespace-nowrap">Thời gian khóa:</Label>
                <div className="w-24">
                  <Select 
                    value={(settings.autoLockHour ?? 8).toString()} 
                    onValueChange={handleAutoLockHourChange}
                    disabled={!settings.autoLockEnabled}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Chọn giờ" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date selector + actions */}
        <Card className="shadow-sm border-slate-200 shrink-0">
          <CardContent className="p-4 bg-white border-b border-slate-200">
            <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4 lg:gap-6 justify-between">
              <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
                <div className="space-y-1.5 min-w-[150px]">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ngày báo cáo</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(getYesterday())} className="h-9">
                    Hôm qua
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(getToday())} className="h-9 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border-blue-200">
                    Hôm nay
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0 justify-between lg:justify-end">
                <div className="flex bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-medium text-slate-600">Mở: <span className="font-bold text-slate-900">{openCount}</span></span>
                  </div>
                  <div className="w-px h-4 bg-slate-300"></div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-slate-600">Khóa: <span className="font-bold text-slate-900">{lockedCount}</span></span>
                  </div>
                </div>

                {openCount > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleLockAll} className="h-9 shadow-sm">
                    <Lock className="w-4 h-4 mr-2" />
                    Khóa tất cả
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
          
          {/* Reports list */}
          <CardContent className="p-0 bg-white overflow-hidden rounded-b-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold min-w-[150px]">Khoa</th>
                    <th className="px-4 py-3 font-semibold text-center w-32">Trạng thái</th>
                    <th className="px-4 py-3 font-semibold">Người nhập cuối</th>
                    <th className="px-4 py-3 font-semibold">Khóa bởi</th>
                    <th className="px-4 py-3 font-semibold text-right w-32">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                        Đang tải danh sách khoa...
                      </td>
                    </tr>
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-12 text-slate-500 font-medium bg-slate-50/30">
                        Danh sách trống cho ngày {formatDisplayDate(selectedDate)}
                      </td>
                    </tr>
                  ) : (
                    reports.map((r) => (
                    <tr key={r.id} className="group bg-white even:bg-slate-50 border-b border-slate-200 hover:bg-slate-200 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{r.departmentName}</td>
                        <td className="px-4 py-3 text-center">
                          {r.status === REPORT_STATUS.LOCKED ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 pl-1.5 pr-2 w-[85px] justify-center shadow-none">
                              <Lock className="w-3 h-3" /> Đã khóa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 pl-1.5 pr-2 w-[85px] justify-center shadow-none">
                              <Unlock className="w-3 h-3" /> Đang mở
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.reportedBy || <span className="text-slate-400 italic">Chưa nhập</span>}</td>
                        <td className="px-4 py-3 text-slate-600">{r.lockedBy || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {r.status === REPORT_STATUS.LOCKED && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 shadow-sm border-slate-200 text-slate-700 hover:bg-slate-100"
                              onClick={() => handleUnlock(r.id, r.departmentName)}
                            >
                              <Unlock className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Mở khóa
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center justify-between gap-4 px-4 py-3 rounded-lg shadow-lg bg-slate-800 text-white animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className={`w-5 h-5 ${toast.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`} />
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
