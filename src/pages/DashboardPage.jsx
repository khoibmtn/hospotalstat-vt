import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { onReportsByDate, onReportsByDateRange } from '../services/reportService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { getDiseaseCatalog } from '../services/diseaseCatalogService';
import { aggregateDeptSummaries } from '../utils/computedColumns';
import { getToday, formatDisplayDate } from '../utils/dateUtils';
import { INPATIENT_FIELDS } from '../utils/constants';
import { format, subDays, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, LayoutDashboard, CalendarDays, RotateCcw,
  Skull, Bug, TrendingUp, TrendingDown, Minus,
  ChevronRight, ChevronDown, ChevronUp, Monitor, Users, Activity, Eye, EyeOff,
} from 'lucide-react';

const DATE_FMT = 'yyyy-MM-dd';

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isTvMode = searchParams.get('mode') === 'tv';

  const [selectedDate, setSelectedDate] = useState(getToday());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [todayReports, setTodayReports] = useState([]);
  const [yesterdayReports, setYesterdayReports] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [trendFilter, setTrendFilter] = useState('__all__');
  const [departments, setDepartments] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [diseaseCatalog, setDiseaseCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendOpen, setTrendOpen] = useState(true);
  const [showTuaTruc, setShowTuaTruc] = useState(false);

  const isToday = selectedDate === getToday();

  useEffect(() => {
    async function loadConfig() {
      const [facs, depts, catalog] = await Promise.all([
        getFacilities(), getDepartments(), getDiseaseCatalog(),
      ]);
      setFacilities(facs);
      setDepartments(depts);
      setDiseaseCatalog(catalog);
    }
    loadConfig();
  }, []);

  // Build trend data from raw range reports
  const buildTrend = useCallback((rangeReports) => {
    const byDate = {};
    rangeReports.forEach((r) => {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, reps]) => {
        const row = { date: formatDisplayDate(date), _raw: reps };
        const allTotals = aggregateDeptSummaries(reps);
        row.bnHienTai = allTotals.bnHienTai;
        row.vaoVien = allTotals.vaoVien;
        row.raVien = allTotals.raVien;
        reps.forEach((r) => {
          row[`dept_${r.departmentId}_bnHienTai`] = r.bnHienTai || 0;
          row[`dept_${r.departmentId}_vaoVien`] = r.vaoVien || 0;
          row[`dept_${r.departmentId}_raVien`] = r.raVien || 0;
        });
        const facMap = {};
        reps.forEach((r) => {
          const dept = departments.find((d) => d.id === r.departmentId);
          const facId = dept?.facilityId;
          if (!facId) return;
          if (!facMap[facId]) facMap[facId] = { bnHienTai: 0, vaoVien: 0, raVien: 0 };
          facMap[facId].bnHienTai += r.bnHienTai || 0;
          facMap[facId].vaoVien += r.vaoVien || 0;
          facMap[facId].raVien += r.raVien || 0;
        });
        Object.entries(facMap).forEach(([facId, vals]) => {
          row[`fac_${facId}_bnHienTai`] = vals.bnHienTai;
          row[`fac_${facId}_vaoVien`] = vals.vaoVien;
          row[`fac_${facId}_raVien`] = vals.raVien;
        });
        return row;
      });
  }, [departments]);

  // Real-time Firestore listeners
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (departments.length === 0) return;
    setLoading(true);
    initialLoadDone.current = false;
    let todayDone = false, yDone = false, trendDone = false;
    const checkReady = () => {
      if (todayDone && yDone && trendDone && !initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    };

    const yesterdayStr = format(subDays(parse(selectedDate, DATE_FMT, new Date()), 1), DATE_FMT);
    const trendStart = format(subDays(parse(selectedDate, DATE_FMT, new Date()), 6), DATE_FMT);

    const unsub1 = onReportsByDate(selectedDate, (reports) => {
      setTodayReports(reports);
      todayDone = true;
      checkReady();
    });

    const unsub2 = onReportsByDate(yesterdayStr, (yReports) => {
      setYesterdayReports(yReports);
      yDone = true;
      checkReady();
    });

    const unsub3 = onReportsByDateRange(trendStart, selectedDate, (rangeReports) => {
      setTrendData(buildTrend(rangeReports));
      trendDone = true;
      checkReady();
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [selectedDate, departments.length, buildTrend]);

  // ─── Computed data ──────────────────────────────────
  const totals = useMemo(() => aggregateDeptSummaries(todayReports), [todayReports]);
  const yTotals = useMemo(() => aggregateDeptSummaries(yesterdayReports), [yesterdayReports]);

  const activeDepts = useMemo(
    () => departments.filter((d) => d.active !== false),
    [departments],
  );

  // BTN summary
  const btnSummary = useMemo(() => {
    const diseaseMap = {};
    todayReports.forEach((r) => {
      (r.infectiousData || []).forEach((item) => {
        if (!item.diseaseName) return;
        const bnHienTai = Number(item.bnHienTai) || 0;
        const vaoVien = Number(item.vaoVien) || 0;
        if (bnHienTai === 0 && vaoVien === 0) return;
        if (!diseaseMap[item.diseaseName]) {
          diseaseMap[item.diseaseName] = { name: item.diseaseName, bnHienTai: 0, vaoVien: 0, diseaseId: item.diseaseId };
        }
        diseaseMap[item.diseaseName].bnHienTai += bnHienTai;
        diseaseMap[item.diseaseName].vaoVien += vaoVien;
      });
    });
    return Object.values(diseaseMap).sort((a, b) => b.bnHienTai - a.bnHienTai);
  }, [todayReports]);
  const totalBTN = btnSummary.reduce((s, d) => s + d.bnHienTai, 0);

  // Yesterday BTN for deltas
  const yBtnMap = useMemo(() => {
    const map = {};
    yesterdayReports.forEach((r) => {
      (r.infectiousData || []).forEach((item) => {
        if (!item.diseaseName) return;
        const val = Number(item.bnHienTai) || 0;
        if (!map[item.diseaseName]) map[item.diseaseName] = 0;
        map[item.diseaseName] += val;
      });
    });
    return map;
  }, [yesterdayReports]);
  const yTotalBTN = Object.values(yBtnMap).reduce((s, v) => s + v, 0);

  // Death breakdown by department
  const deathByDept = useMemo(() => {
    const result = [];
    todayReports.forEach((r) => {
      const tv = Number(r.tuVong) || 0;
      if (tv > 0) result.push({ dept: r.departmentName, count: tv });
    });
    return result;
  }, [todayReports]);

  // Death cases that have not been documented
  const deathCasesCount = useMemo(() => {
    let total = 0;
    todayReports.forEach((r) => { total += (r.deathCases || []).length; });
    return total;
  }, [todayReports]);
  const undocumentedDeaths = (totals.tuVong || 0) - deathCasesCount;

  // Grouped table data
  const groupedData = useMemo(() => {
    const reportMap = {};
    todayReports.forEach((r) => { reportMap[r.departmentId] = r; });

    return facilities.map((fac) => {
      const facDepts = activeDepts
        .filter((d) => d.facilityId === fac.id)
        .map((d) => ({ ...d, report: reportMap[d.id] || null }));
      return { ...fac, departments: facDepts };
    }).filter((g) => g.departments.length > 0);
  }, [facilities, activeDepts, todayReports]);

  // Deltas vs yesterday
  const deltaBN = (totals.bnHienTai ?? 0) - (yTotals.bnHienTai ?? 0);

  // Filtered trend data — supports __all__, fac_xxx, dept_xxx
  const filteredTrendData = useMemo(() => {
    if (trendFilter === '__all__') {
      return trendData.map((d) => ({
        date: d.date,
        bnHienTai: d.bnHienTai,
        vaoVien: d.vaoVien,
        raVien: d.raVien,
      }));
    }
    const prefix = trendFilter.startsWith('fac_') ? trendFilter : `dept_${trendFilter}`;
    return trendData.map((d) => ({
      date: d.date,
      bnHienTai: d[`${prefix}_bnHienTai`] ?? 0,
      vaoVien: d[`${prefix}_vaoVien`] ?? 0,
      raVien: d[`${prefix}_raVien`] ?? 0,
    }));
  }, [trendData, trendFilter]);

  const selectedDeptName = useMemo(() => {
    if (trendFilter === '__all__') return 'Toàn viện';
    if (trendFilter.startsWith('fac_')) {
      const facId = trendFilter.replace('fac_', '');
      const fac = facilities.find((f) => f.id === facId);
      return fac?.name || 'Cơ sở';
    }
    const d = departments.find((d) => d.id === trendFilter);
    return d?.name || 'Khoa';
  }, [trendFilter, departments, facilities]);

  function handleDateSelect(date) {
    if (date) {
      setSelectedDate(format(date, DATE_FMT));
      setCalendarOpen(false);
    }
  }

  function toggleTvMode() {
    if (isTvMode) {
      searchParams.delete('mode');
    } else {
      searchParams.set('mode', 'tv');
    }
    setSearchParams(searchParams);
  }

  function formatDelta(val) {
    if (val > 0) return `+${val}`;
    if (val < 0) return `${val}`;
    return '0';
  }

  // Loading state
  if (departments.length === 0 && loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-slate-500 animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-500" />
          <div className="font-medium">Đang tải dashboard...</div>
        </div>
      </div>
    );
  }

  const tvClass = isTvMode ? 'tv-mode' : '';

  return (
    <div className={`flex flex-col h-full bg-slate-50/50 p-4 md:p-6 pb-24 overflow-x-hidden ${tvClass}`}>

      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <LayoutDashboard className={`text-blue-600 ${isTvMode ? 'w-8 h-8' : 'w-6 h-6'}`} />
          <h1 className={`font-bold tracking-tight text-slate-900 ${isTvMode ? 'text-3xl' : 'text-2xl'}`}>
            Dashboard
          </h1>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 gap-2 text-sm font-medium cursor-pointer">
                <CalendarDays className="w-4 h-4 text-slate-500" />
                {formatDisplayDate(selectedDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                locale={vi}
                selected={parse(selectedDate, DATE_FMT, new Date())}
                onSelect={handleDateSelect}
                disabled={(d) => d > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-sm cursor-pointer"
            disabled={isToday}
            onClick={() => setSelectedDate(getToday())}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hôm nay
          </Button>
          <Button
            variant={isTvMode ? 'default' : 'ghost'}
            size="sm"
            className="h-9 gap-1.5 text-sm cursor-pointer"
            onClick={toggleTvMode}
            title="Chế độ trình chiếu"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isTvMode ? 'Tắt TV' : 'TV'}</span>
          </Button>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="flex-1 overflow-auto flex flex-col gap-5">

        {/* ═══ KPI ROW: 4 COMPACT CARDS ═══ */}
        <div className={`grid gap-3 shrink-0 ${totalBTN > 0
          ? (isTvMode ? 'grid-cols-[1fr_1fr_1fr_2fr]' : 'grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr]')
          : (isTvMode ? 'grid-cols-4' : 'grid-cols-2 lg:grid-cols-4')
        }`}>

          {/* 1) BN hiện tại */}
          <Card className="shadow-sm border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">BN hiện tại</span>
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`font-black text-blue-900 ${isTvMode ? 'text-5xl' : 'text-4xl'}`}>
                  {(totals.bnHienTai ?? 0).toLocaleString()}
                </span>
                {yesterdayReports.length > 0 && (
                  <span className={`text-sm font-semibold px-1.5 py-0.5 rounded ${
                    deltaBN > 0 ? 'text-red-600 bg-red-50' :
                    deltaBN < 0 ? 'text-emerald-600 bg-emerald-50' :
                    'text-slate-400 bg-slate-50'
                  }`}>
                    {formatDelta(deltaBN)}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">so với hôm trước</div>
            </CardContent>
          </Card>

          {/* 2) BN mới (Vào viện) */}
          <Card className="shadow-sm border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">BN mới</span>
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`font-black text-emerald-900 ${isTvMode ? 'text-5xl' : 'text-4xl'}`}>
                  {(totals.vaoVien ?? 0).toLocaleString()}
                </span>
                {yesterdayReports.length > 0 && (() => {
                  const dVao = (totals.vaoVien ?? 0) - (yTotals.vaoVien ?? 0);
                  return (
                    <span className={`text-sm font-semibold px-1.5 py-0.5 rounded ${
                      dVao > 0 ? 'text-red-600 bg-red-50' :
                      dVao < 0 ? 'text-emerald-600 bg-emerald-50' :
                      'text-slate-400 bg-slate-50'
                    }`}>
                      {formatDelta(dVao)}
                    </span>
                  );
                })()}
              </div>
              <div className="text-xs text-slate-400 mt-1">vào viện hôm nay</div>
            </CardContent>
          </Card>

          {/* 3) Tử vong — clickable */}
          <Card
            className={`shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${
              totals.tuVong > 0
                ? 'border-red-400 bg-gradient-to-br from-red-50 to-red-100/50 ring-1 ring-red-200'
                : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white'
            }`}
            onClick={() => navigate('/summary?tab=deathlist')}
            title="Click để xem danh sách tử vong"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  totals.tuVong > 0 ? 'text-red-600' : 'text-slate-500'
                }`}>
                  Tử vong
                </span>
                <Skull className={`w-5 h-5 ${
                  totals.tuVong > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'
                }`} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`font-black ${
                  totals.tuVong > 0 ? 'text-red-700' : 'text-slate-700'
                } ${isTvMode ? 'text-5xl' : 'text-4xl'}`}>
                  {totals.tuVong ?? 0}
                </span>
              </div>
              {/* Dept breakdown + undocumented */}
              {totals.tuVong > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {deathByDept.map((d) => (
                    <span key={d.dept} className="text-xs text-red-600 mr-2">
                      {d.dept}: {d.count}
                    </span>
                  ))}
                  {undocumentedDeaths > 0 && (
                    <div className="text-xs text-amber-600 font-medium">
                      {undocumentedDeaths} ca chưa nhập
                    </div>
                  )}
                </div>
              )}
              {totals.tuVong > 0 && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
                  Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4) Bệnh truyền nhiễm — wider, side-by-side layout */}
          <Card className={`shadow-sm overflow-hidden ${
            totalBTN > 0
              ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/50'
              : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white'
          }`}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Left: Total */}
                <div className="shrink-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bug className={`w-5 h-5 ${
                      totalBTN > 0 ? 'text-amber-500' : 'text-slate-400'
                    }`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      totalBTN > 0 ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      B. Truyền nhiễm
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-black ${
                      totalBTN > 0 ? 'text-amber-800' : 'text-slate-700'
                    } ${isTvMode ? 'text-5xl' : 'text-4xl'}`}>
                      {totalBTN}
                    </span>
                    {yesterdayReports.length > 0 && (() => {
                      const dBTN = totalBTN - yTotalBTN;
                      return dBTN !== 0 ? (
                        <span className={`text-sm font-semibold px-1.5 py-0.5 rounded ${
                          dBTN > 0 ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'
                        }`}>
                          {formatDelta(dBTN)}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">tổng ca</div>
                </div>
                {/* Right: Disease list with deltas */}
                {btnSummary.length > 0 && (
                  <div className="flex-1 min-w-0 border-l border-amber-200/60 pl-3 space-y-1 max-h-[120px] overflow-y-auto flex flex-col justify-center">
                    {btnSummary.map((d) => {
                      const catalogItem = diseaseCatalog.find((c) => c.name === d.name);
                      const color = catalogItem?.color || '#f59e0b';
                      const yVal = yBtnMap[d.name] || 0;
                      const delta = d.bnHienTai - yVal;
                      return (
                        <div key={d.name} className="flex items-center gap-1 text-sm">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-slate-700 font-medium">{d.name}</span>
                          <span className="font-bold text-amber-800 shrink-0 ml-1">{d.bnHienTai}</span>
                          {yesterdayReports.length > 0 && delta !== 0 && (
                            <span className={`text-xs font-bold shrink-0 ${delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                              ({formatDelta(delta)})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>



        {/* ═══ TREND CHART — collapsible ═══ */}
        <Card className="shadow-sm border-slate-200 shrink-0">
          <CardHeader
            className="py-3 px-4 border-b border-slate-100 bg-slate-50/50 cursor-pointer select-none"
            onClick={() => setTrendOpen((p) => !p)}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className={`font-semibold text-slate-800 flex items-center gap-2 ${isTvMode ? 'text-lg' : 'text-base'}`}>
                {trendOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                Xu hướng 7 ngày {trendFilter !== '__all__' && `— ${selectedDeptName}`}
              </CardTitle>
              {trendOpen && (
                <div onClick={(e) => e.stopPropagation()}>
                  <Select value={trendFilter} onValueChange={setTrendFilter}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Toàn viện" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">🏥 Toàn viện</SelectItem>
                      {facilities.filter((f) => activeDepts.some((d) => d.facilityId === f.id)).map((fac) => {
                        const facDepts = activeDepts.filter((d) => d.facilityId === fac.id);
                        return (
                          <Fragment key={fac.id}>
                            <SelectItem value={`fac_${fac.id}`} className="font-bold bg-slate-100 text-slate-800">
                              🏗️ {fac.name}
                            </SelectItem>
                            {facDepts.map((d) => (
                              <SelectItem key={d.id} value={d.id} className="pl-7">
                                {d.name}
                              </SelectItem>
                            ))}
                          </Fragment>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          {trendOpen && (
            <CardContent className="p-4 bg-white">
              {filteredTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={isTvMode ? 360 : 280}>
                  <LineChart data={filteredTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" fontSize={isTvMode ? 14 : 12} stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis fontSize={isTvMode ? 14 : 12} stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: isTvMode ? 14 : 12,
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '12px' }} />
                    <Line type="monotone" dataKey="bnHienTai" name="BN hiện tại" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, fill: '#2563eb' }} />
                    <Line type="monotone" dataKey="vaoVien" name="Vào viện" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#fff' }} />
                    <Line type="monotone" dataKey="raVien" name="Ra viện" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex items-center justify-center text-slate-500 font-medium bg-slate-50/30 rounded-lg ${isTvMode ? 'h-[360px]' : 'h-[280px]'}`}>
                  Chưa có dữ liệu xu hướng
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* ═══ FACILITY-GROUPED TABLE ═══ */}
        <Card className="shadow-sm border-slate-200 shrink-0">
          <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className={`font-semibold text-slate-800 ${isTvMode ? 'text-lg' : 'text-base'}`}>
                Chi tiết theo Khoa — {formatDisplayDate(selectedDate)}
              </CardTitle>
              <Button
                variant={showTuaTruc ? 'default' : 'outline'}
                size="sm"
                className="h-7 gap-1.5 text-xs cursor-pointer"
                onClick={() => setShowTuaTruc((p) => !p)}
              >
                {showTuaTruc ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                Tua trực
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-white rounded-b-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className={`w-full text-left border-collapse tabular-nums ${isTvMode ? 'text-base' : 'text-sm'}`}>
                <thead className={`text-white uppercase bg-blue-600 ${isTvMode ? 'text-sm' : 'text-xs'}`}>
                  <tr>
                    <th className="px-4 py-3 font-semibold border-r border-blue-500 min-w-[180px]">Khoa</th>
                    {showTuaTruc && (
                      <th className="px-3 py-3 font-semibold border-r border-blue-500 min-w-[120px]">Tua trực</th>
                    )}
                    {INPATIENT_FIELDS.map((f) => (
                      <th key={f.key} className="px-2 py-3 font-semibold border-r border-blue-500 min-w-[70px] text-center">
                        {f.label}
                      </th>
                    ))}
                    <th className="px-2 py-3 font-semibold min-w-[60px] text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedData.map((group) => {
                    const facReports = group.departments
                      .map((d) => d.report)
                      .filter(Boolean);
                    const facTotals = aggregateDeptSummaries(facReports);

                    return (
                      <Fragment key={group.id}>
                        <tr className="bg-slate-100 border-b-2 border-slate-200">
                          <td
                            colSpan={INPATIENT_FIELDS.length + 2 + (showTuaTruc ? 1 : 0)}
                            className="px-4 py-2 font-bold text-slate-700 uppercase tracking-wide text-xs"
                          >
                            🏗️ {group.name}
                          </td>
                        </tr>
                        {group.departments.map((dept) => {
                          const r = dept.report;
                          const hasReport = !!r;
                          return (
                            <tr
                              key={dept.id}
                              className={`transition-colors ${
                                hasReport
                                  ? 'bg-white hover:bg-slate-50'
                                  : 'bg-red-50/40 hover:bg-red-50'
                              }`}
                            >
                              <td className="px-4 py-2 font-medium border-r border-slate-200 whitespace-nowrap text-slate-800">
                                {dept.name}
                              </td>
                              {showTuaTruc && (
                                <td className="px-3 py-2 border-r border-slate-200 text-slate-600 text-xs whitespace-nowrap">
                                  {r?.tuaTruc || '—'}
                                </td>
                              )}
                              {INPATIENT_FIELDS.map((f) => (
                                <td
                                  key={f.key}
                                  className={`px-2 py-2 border-r border-slate-100 text-center align-middle ${
                                    f.computed ? 'font-semibold text-blue-700 bg-blue-50/30' : ''
                                  } ${f.key === 'tuVong' && r && r.tuVong > 0 ? 'text-red-600 font-bold bg-red-50' : ''}`}
                                >
                                  {hasReport ? (r[f.key] ?? 0) : '—'}
                                </td>
                              ))}
                              <td className="px-2 py-2 text-center">
                                {hasReport ? (
                                  <span className="text-emerald-500 text-xs font-semibold">✓</span>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-red-100 text-red-600 border-red-200 px-1.5">
                                    ❌ Chưa nhập
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {group.departments.length > 1 && (
                          <tr className="bg-slate-200/80 font-bold border-b-2 border-slate-300">
                            <td className="px-4 py-2.5 text-slate-700 border-r border-slate-300 text-xs uppercase tracking-wide">
                              ⮑ Tổng {group.name}
                            </td>
                            {showTuaTruc && <td className="border-r border-slate-300" />}
                            {INPATIENT_FIELDS.map((f) => (
                              <td key={f.key} className="px-2 py-2.5 border-r border-slate-300 text-center text-slate-800 font-bold">
                                {facTotals[f.key] ?? 0}
                              </td>
                            ))}
                            <td className="px-2 py-2.5 text-center text-xs text-slate-500 font-semibold">
                              {facReports.length}/{group.departments.length}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {todayReports.length > 0 && (
                    <tr className="bg-blue-600 text-white font-black border-t-4 border-blue-700">
                      <td className="px-4 py-3.5 border-r border-blue-500 whitespace-nowrap uppercase text-base tracking-wide">
                        TỔNG TOÀN VIỆN
                      </td>
                      {showTuaTruc && <td className="border-r border-blue-500" />}
                      {INPATIENT_FIELDS.map((f) => (
                        <td
                          key={f.key}
                          className={`px-2 py-3.5 border-r border-blue-500 text-center text-base font-black ${
                            f.key === 'tuVong' && totals.tuVong > 0 ? 'text-red-200 bg-red-900/30' : ''
                          }`}
                        >
                          {totals[f.key] ?? 0}
                        </td>
                      ))}
                      <td className="px-2 py-3.5 text-center text-sm text-blue-200 font-bold">
                        {todayReports.length}/{activeDepts.length}
                      </td>
                    </tr>
                  )}

                  {todayReports.length === 0 && !loading && (
                    <tr>
                      <td colSpan={INPATIENT_FIELDS.length + 2 + (showTuaTruc ? 1 : 0)} className="text-center p-12 text-slate-500 font-medium bg-slate-50/30">
                        Chưa có khoa nào nhập dữ liệu cho ngày {formatDisplayDate(selectedDate)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
