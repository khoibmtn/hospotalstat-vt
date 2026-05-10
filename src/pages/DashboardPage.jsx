import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { onReportsByDate, onReportsByDateRange } from '../services/reportService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { getDiseaseCatalog } from '../services/diseaseCatalogService';
import { aggregateDeptSummaries } from '../utils/computedColumns';
import { getToday, getYesterday, formatDisplayDate } from '../utils/dateUtils';
import { INPATIENT_FIELDS } from '../utils/constants';
import { getSettings, updateSettings } from '../services/settingsService';
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
  Skull, Bug, TrendingUp, TrendingDown, Minus, Plus,
  ChevronRight, ChevronDown, ChevronUp, Monitor, Users, Activity, Eye, EyeOff,
  ALargeSmall, ArrowUpDown,
} from 'lucide-react';

const DATE_FMT = 'yyyy-MM-dd';

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isTvMode = searchParams.get('mode') === 'tv';

  const [selectedDate, setSelectedDate] = useState(getYesterday());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [todayReports, setTodayReports] = useState([]);
  const [yesterdayReports, setYesterdayReports] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [trendFilter, setTrendFilter] = useState('__all__');
  const [trendRange, setTrendRange] = useState(7);
  const [departments, setDepartments] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [diseaseCatalog, setDiseaseCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendOpen, setTrendOpen] = useState(true);
  const [btnTrendOpen, setBtnTrendOpen] = useState(false);
  const [btnTrendFilter, setBtnTrendFilter] = useState('__all__');
  const [showTuaTruc, setShowTuaTruc] = useState(false);
  const [dashboardTab, setDashboardTab] = useState('overview');
  const [rowPy, setRowPy] = useState(2);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [tableFontSize, setTableFontSize] = useState(11);

  // Auto-measure remaining viewport height for KCB tab
  const kcbContainerRef = useRef(null);
  const [kcbHeight, setKcbHeight] = useState('100vh');

  useEffect(() => {
    if (dashboardTab !== 'kcb' || !kcbContainerRef.current) return;
    const measure = () => {
      const top = kcbContainerRef.current.getBoundingClientRect().top;
      setKcbHeight(`${window.innerHeight - top - 8}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [dashboardTab, isTvMode]);

  // Drag-to-resize sidebar
  const isDragging = useRef(false);
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    let latestW = startW;
    const onMove = (ev) => {
      const delta = startX - ev.clientX;
      latestW = Math.max(180, Math.min(500, startW + delta));
      setSidebarWidth(latestW);
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      updateSettings({ dashboardSidebarWidth: latestW });
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const TREND_RANGES = [
    { label: '1 tuần', days: 7 },
    { label: '2 tuần', days: 14 },
    { label: '1 tháng', days: 30 },
    { label: '1 quý', days: 90 },
  ];

  const isToday = selectedDate === getToday();
  const isYesterday = selectedDate === getYesterday();

  useEffect(() => {
    async function loadConfig() {
      const [facs, depts, catalog] = await Promise.all([
        getFacilities(), getDepartments(), getDiseaseCatalog(),
      ]);
      setFacilities(facs);
      setDepartments(depts);
      setDiseaseCatalog(catalog);

      // Load dashboard row padding from settings
      const s = await getSettings();
      if (s.dashboardRowPy != null) setRowPy(s.dashboardRowPy);
      if (s.dashboardSidebarWidth != null) setSidebarWidth(s.dashboardSidebarWidth);
      if (s.dashboardFontSize != null) setTableFontSize(s.dashboardFontSize);
    }
    loadConfig();
  }, []);

  // Auto-collapse trend chart when entering TV mode
  useEffect(() => {
    setTrendOpen(!isTvMode);
  }, [isTvMode]);

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
    const trendStart = format(subDays(parse(selectedDate, DATE_FMT, new Date()), trendRange - 1), DATE_FMT);

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
  }, [selectedDate, departments.length, buildTrend, trendRange]);

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

  // BTN trend data — aggregate infectious cases per date, optionally filtered by disease
  const allDiseaseNames = useMemo(() => {
    const nameSet = new Set();
    trendData.forEach((d) => {
      (d._raw || []).forEach((r) => {
        (r.infectiousData || []).forEach((item) => {
          if (item.diseaseName) nameSet.add(item.diseaseName);
        });
      });
    });
    return [...nameSet].sort();
  }, [trendData]);

  const btnTrendData = useMemo(() => {
    return trendData.map((d) => {
      let totalBn = 0;
      let totalVao = 0;
      (d._raw || []).forEach((r) => {
        (r.infectiousData || []).forEach((item) => {
          if (!item.diseaseName) return;
          if (btnTrendFilter !== '__all__' && item.diseaseName !== btnTrendFilter) return;
          totalBn += Number(item.bnHienTai) || 0;
          totalVao += Number(item.vaoVien) || 0;
        });
      });
      return { date: d.date, bnHienTai: totalBn, vaoVien: totalVao };
    });
  }, [trendData, btnTrendFilter]);

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
    <div className={`flex flex-col h-full bg-slate-50/50 ${isTvMode ? 'p-3' : 'p-4 md:p-6 pb-24'} overflow-x-hidden ${tvClass}`}>

      {/* ─── HEADER ─── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between ${isTvMode ? 'mb-2' : 'mb-5'} gap-3 shrink-0`}>
        <div className="flex items-center gap-3">
          <LayoutDashboard className={`text-blue-600 ${isTvMode ? 'w-8 h-8' : 'w-6 h-6'}`} />
          <h1 className={`font-bold tracking-tight text-slate-900 ${isTvMode ? 'text-3xl' : 'text-xl'}`}>
            Báo cáo số liệu KCB ngày {formatDisplayDate(selectedDate)}
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
            variant={isYesterday ? 'default' : 'outline'}
            size="sm"
            className={`h-9 gap-1.5 text-sm cursor-pointer ${isYesterday ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
            disabled={isYesterday}
            onClick={() => setSelectedDate(getYesterday())}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hôm qua
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-sm cursor-pointer"
            disabled={isToday}
            onClick={() => setSelectedDate(getToday())}
          >
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

      {/* ─── TAB SWITCHER ─── */}
      <div className={`flex items-center gap-1 ${isTvMode ? 'mb-2' : 'mb-4'} shrink-0`}>
        <button
          onClick={() => setDashboardTab('overview')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            dashboardTab === 'overview'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          📊 Tổng quan
        </button>
        <button
          onClick={() => setDashboardTab('kcb')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            dashboardTab === 'kcb'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          🏥 Số liệu KCB
        </button>
      </div>

      {/* ─── CONTENT ─── */}
      <div
        className="flex-1 overflow-y-auto"
        style={isTvMode ? { scrollSnapType: 'y mandatory' } : {}}
      >
        {/* ═══ TAB: TỔNG QUAN ═══ */}
        <div style={{ display: dashboardTab === 'overview' ? undefined : 'none' }}>
        <div
          className={isTvMode ? 'h-full flex flex-col gap-3 pb-1' : 'flex flex-col gap-5'}
          style={isTvMode ? { scrollSnapAlign: 'start' } : {}}
        >

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
            onClick={() => navigate(`/summary?tab=deathlist&from=${selectedDate}&to=${selectedDate}`)}
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
                Xu hướng {TREND_RANGES.find(r => r.days === trendRange)?.label ?? `${trendRange} ngày`}
                {trendFilter !== '__all__' && ` — ${selectedDeptName}`}
              </CardTitle>
              {trendOpen && (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {/* Range selector */}
                  <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden bg-white">
                    {TREND_RANGES.map((r) => (
                      <button
                        key={r.days}
                        onClick={() => setTrendRange(r.days)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          trendRange === r.days
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {/* Dept filter */}
                  <Select value={trendFilter} onValueChange={setTrendFilter}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
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
                    <XAxis
                      dataKey="date"
                      fontSize={isTvMode ? 14 : 12}
                      stroke="#64748b"
                      tickLine={false}
                      axisLine={false}
                      interval={trendRange <= 7 ? 0 : trendRange <= 14 ? 1 : trendRange <= 30 ? 4 : 'preserveStartEnd'}
                    />
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
                    <Line
                      type="monotone" dataKey="bnHienTai" name="BN hiện tại" stroke="#2563eb" strokeWidth={trendRange > 14 ? 2 : 3}
                      dot={trendRange > 14 ? false : { r: 4, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 5, fill: '#2563eb' }}
                    />
                    <Line
                      type="monotone" dataKey="vaoVien" name="Vào viện" stroke="#10b981" strokeWidth={2}
                      dot={trendRange > 14 ? false : { r: 3, fill: '#fff' }}
                      activeDot={{ r: 4, fill: '#10b981' }}
                    />
                    <Line
                      type="monotone" dataKey="raVien" name="Ra viện" stroke="#f59e0b" strokeWidth={2}
                      dot={trendRange > 14 ? false : { r: 3, fill: '#fff' }}
                      activeDot={{ r: 4, fill: '#f59e0b' }}
                    />
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

        {/* ═══ BTN TREND CHART — collapsible ═══ */}
        <Card className="shadow-sm border-amber-200 shrink-0">
          <CardHeader
            className="py-3 px-4 border-b border-amber-100 bg-amber-50/50 cursor-pointer select-none"
            onClick={() => setBtnTrendOpen((p) => !p)}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className={`font-semibold text-amber-800 flex items-center gap-2 ${isTvMode ? 'text-lg' : 'text-base'}`}>
                {btnTrendOpen ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
                <Bug className="w-4 h-4" />
                Xu hướng Bệnh truyền nhiễm {TREND_RANGES.find(r => r.days === trendRange)?.label ?? `${trendRange} ngày`}
                {btnTrendFilter !== '__all__' && ` — ${btnTrendFilter}`}
              </CardTitle>
              {btnTrendOpen && (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Select value={btnTrendFilter} onValueChange={setBtnTrendFilter}>
                    <SelectTrigger className="w-[220px] h-8 text-xs">
                      <SelectValue placeholder="Tất cả bệnh" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">🧬 Tất cả bệnh truyền nhiễm</SelectItem>
                      {allDiseaseNames.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          {btnTrendOpen && (
            <CardContent className="p-4 bg-white">
              {btnTrendData.some((d) => d.bnHienTai > 0 || d.vaoVien > 0) ? (
                <ResponsiveContainer width="100%" height={isTvMode ? 300 : 220}>
                  <LineChart data={btnTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" vertical={false} />
                    <XAxis
                      dataKey="date"
                      fontSize={isTvMode ? 14 : 12}
                      stroke="#92400e"
                      tickLine={false}
                      axisLine={false}
                      interval={trendRange <= 7 ? 0 : trendRange <= 14 ? 1 : trendRange <= 30 ? 4 : 'preserveStartEnd'}
                    />
                    <YAxis fontSize={isTvMode ? 14 : 12} stroke="#92400e" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid #fde68a',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backgroundColor: '#fffbeb',
                        color: '#78350f',
                        fontSize: isTvMode ? 14 : 12,
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '12px' }} />
                    <Line
                      type="monotone" dataKey="bnHienTai" name="BN hiện tại" stroke="#d97706" strokeWidth={trendRange > 14 ? 2 : 3}
                      dot={trendRange > 14 ? false : { r: 4, strokeWidth: 2, fill: '#fffbeb' }}
                      activeDot={{ r: 5, fill: '#d97706' }}
                    />
                    <Line
                      type="monotone" dataKey="vaoVien" name="Vào viện" stroke="#ea580c" strokeWidth={2}
                      dot={trendRange > 14 ? false : { r: 3, fill: '#fffbeb' }}
                      activeDot={{ r: 4, fill: '#ea580c' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex items-center justify-center text-amber-600 font-medium bg-amber-50/30 rounded-lg ${isTvMode ? 'h-[300px]' : 'h-[220px]'}`}>
                  Không có dữ liệu bệnh truyền nhiễm trong giai đoạn này
                </div>
              )}
            </CardContent>
          )}
        </Card>
        </div>
        </div>

        {/* ═══ TAB: SỐ LIỆU KCB ═══ */}
        {dashboardTab === 'kcb' && (
        <div ref={kcbContainerRef} className="flex gap-3" style={{ height: kcbHeight }}>
          <div className="flex-1 min-w-0 flex flex-col">
          <Card className="shadow-sm border-slate-200 flex-1 min-h-0 flex flex-col">
          <CardHeader className="py-1.5 px-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="font-semibold text-slate-800 text-sm">
                Chi tiết theo Khoa — {formatDisplayDate(selectedDate)}
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Font Size control */}
                <div className="flex items-center gap-1" title="Cỡ chữ">
                  <ALargeSmall className="w-3.5 h-3.5 text-slate-400" />
                  <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                    <button
                      className="px-1 py-0.5 text-slate-500 hover:bg-slate-100 transition-colors"
                      onClick={() => {
                        const next = Math.max(8, tableFontSize - 1);
                        setTableFontSize(next);
                        updateSettings({ dashboardFontSize: next });
                      }}
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="px-1 text-[10px] text-slate-500 font-mono border-x border-slate-200 select-none w-5 text-center">{tableFontSize}</span>
                    <button
                      className="px-1 py-0.5 text-slate-500 hover:bg-slate-100 transition-colors"
                      onClick={() => {
                        const next = Math.min(18, tableFontSize + 1);
                        setTableFontSize(next);
                        updateSettings({ dashboardFontSize: next });
                      }}
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                {/* Row Height control */}
                <div className="flex items-center gap-1" title="Chiều cao dòng">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                    <button
                      className="px-1 py-0.5 text-slate-500 hover:bg-slate-100 transition-colors"
                      onClick={() => {
                        const next = Math.max(0, rowPy - 1);
                        setRowPy(next);
                        updateSettings({ dashboardRowPy: next });
                      }}
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="px-1 text-[10px] text-slate-500 font-mono border-x border-slate-200 select-none w-5 text-center">{rowPy}</span>
                    <button
                      className="px-1 py-0.5 text-slate-500 hover:bg-slate-100 transition-colors"
                      onClick={() => {
                        const next = Math.min(16, rowPy + 1);
                        setRowPy(next);
                        updateSettings({ dashboardRowPy: next });
                      }}
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                {/* Divider */}
                <div className="w-px h-5 bg-slate-200" />
                <Button
                  variant={showTuaTruc ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 gap-1 text-[11px] cursor-pointer"
                  onClick={() => setShowTuaTruc((p) => !p)}
                >
                  {showTuaTruc ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  Tua trực
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-white rounded-b-xl flex-1 min-h-0 overflow-auto">
            <div>
              <table className="w-full text-left border-collapse tabular-nums" style={{ fontSize: `${tableFontSize}px` }}>
                <thead className="text-white uppercase bg-blue-600 sticky top-0 z-10" style={{ fontSize: `${Math.max(9, tableFontSize - 1)}px` }}>
                  <tr>
                    <th className="px-2 py-1 font-semibold border-r border-blue-500 whitespace-nowrap">Khoa</th>
                    {showTuaTruc && (
                      <th className="px-2 py-1 font-semibold border-r border-blue-500">Tua trực</th>
                    )}
                    {INPATIENT_FIELDS.map((f) => (
                      <th key={f.key} className="px-1 py-1 font-semibold border-r border-blue-500 text-center whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                    <th className="px-1 py-1 font-semibold text-center">TT</th>
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
                            className="px-2 font-bold text-slate-700 uppercase tracking-wide text-[10px]"
                            style={{ paddingTop: rowPy, paddingBottom: rowPy }}
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
                              <td className="px-2 font-medium border-r border-slate-200 whitespace-nowrap text-slate-800" style={{ paddingTop: rowPy, paddingBottom: rowPy }}>
                                {dept.name}
                              </td>
                              {showTuaTruc && (
                                <td className="px-2 border-r border-slate-200 text-slate-600 text-[10px] whitespace-nowrap" style={{ paddingTop: rowPy, paddingBottom: rowPy }}>
                                  {r?.tuaTruc || '—'}
                                </td>
                              )}
                              {INPATIENT_FIELDS.map((f) => (
                                <td
                                  key={f.key}
                                  className={`px-1 border-r border-slate-100 text-center align-middle ${
                                    f.computed ? 'font-semibold text-blue-700 bg-blue-50/30' : ''
                                  } ${f.key === 'tuVong' && r && r.tuVong > 0 ? 'text-red-600 font-bold bg-red-50' : ''}`}
                                  style={{ paddingTop: rowPy, paddingBottom: rowPy, fontSize: `${tableFontSize + 1}px` }}
                                >
                                  {hasReport ? (
                                    <span className={(r[f.key] ?? 0) === 0 ? 'text-slate-400' : ''}>
                                      {r[f.key] ?? 0}
                                    </span>
                                  ) : '—'}
                                </td>
                              ))}
                              <td className="px-1 text-center" style={{ paddingTop: rowPy, paddingBottom: rowPy }}>
                                {hasReport ? (
                                  <span className="text-emerald-500 text-[10px] font-semibold">✓</span>
                                ) : (
                                  <span className="text-red-500 text-[10px]">✕</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {group.departments.length > 1 && (
                          <tr className="bg-orange-50 font-bold border-b border-orange-200">
                            <td className="px-2 text-orange-700 border-r border-orange-200 text-[10px] uppercase tracking-wide" style={{ paddingTop: rowPy, paddingBottom: rowPy }}>
                              ⮑ Tổng {group.name}
                            </td>
                            {showTuaTruc && <td className="border-r border-orange-200" />}
                            {INPATIENT_FIELDS.map((f) => (
                              <td
                                key={f.key}
                                className={`px-1 border-r border-orange-200 text-center font-bold ${
                                  f.key === 'tuVong' && facTotals.tuVong > 0 ? 'text-red-600' : 'text-orange-800'
                                }`}
                                style={{ paddingTop: rowPy, paddingBottom: rowPy, fontSize: `${tableFontSize + 1}px` }}
                              >
                                <span className={(facTotals[f.key] ?? 0) === 0 ? 'text-orange-300' : ''}>
                                  {facTotals[f.key] ?? 0}
                                </span>
                              </td>
                            ))}
                            <td className="px-1 text-center text-[10px] text-orange-600 font-semibold" style={{ paddingTop: rowPy, paddingBottom: rowPy }}>
                              {facReports.length}/{group.departments.length}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {todayReports.length > 0 && (
                    <tr className="bg-blue-600 text-white font-black border-t-2 border-blue-700">
                      <td className="px-2 border-r border-blue-500 whitespace-nowrap uppercase text-xs tracking-wide" style={{ paddingTop: rowPy + 2, paddingBottom: rowPy + 2 }}>
                        TỔNG TOÀN VIỆN
                      </td>
                      {showTuaTruc && <td className="border-r border-blue-500" />}
                      {INPATIENT_FIELDS.map((f) => (
                        <td
                          key={f.key}
                          className={`px-1 border-r border-blue-500 text-center text-xs font-black ${
                            f.key === 'tuVong' && totals.tuVong > 0 ? 'text-red-200 bg-red-900/30' : ''
                          }`}
                          style={{ paddingTop: rowPy + 2, paddingBottom: rowPy + 2, fontSize: `${tableFontSize + 1}px` }}
                        >
                          <span className={(totals[f.key] ?? 0) === 0 && !(f.key === 'tuVong' && totals.tuVong > 0) ? 'text-blue-400' : ''}>
                            {totals[f.key] ?? 0}
                          </span>
                        </td>
                      ))}
                      <td className="px-1 text-center text-[10px] text-blue-200 font-bold" style={{ paddingTop: rowPy + 2, paddingBottom: rowPy + 2 }}>
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
          {/* Drag handle */}
          <div
            className="w-1.5 shrink-0 cursor-col-resize hover:bg-blue-300 bg-slate-200 rounded-full transition-colors active:bg-blue-400 self-stretch"
            onMouseDown={handleResizeStart}
            title="Kéo để thay đổi kích thước"
          />
          <div data-sidebar className="shrink-0 flex flex-col gap-2 overflow-y-auto" style={{ width: sidebarWidth }}>
            {/* BN hiện tại */}
            <Card className="shadow-sm border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">BN hiện tại</span>
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-black text-blue-900 text-3xl">{(totals.bnHienTai ?? 0).toLocaleString()}</span>
                  {yesterdayReports.length > 0 && (
                    <span className={`text-sm font-semibold px-1.5 py-0.5 rounded ${deltaBN > 0 ? 'text-red-600 bg-red-50' : deltaBN < 0 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>{formatDelta(deltaBN)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
            {/* BN mới */}
            <Card className="shadow-sm border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Vào viện</span>
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="font-black text-emerald-900 text-3xl">{(totals.vaoVien ?? 0).toLocaleString()}</span>
              </CardContent>
            </Card>
            {/* Ra viện */}
            <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-slate-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Ra viện</span>
                </div>
                <span className="font-black text-slate-900 text-3xl">{(totals.raVien ?? 0).toLocaleString()}</span>
              </CardContent>
            </Card>
            {/* Tử vong */}
            {(totals.tuVong ?? 0) > 0 && (
              <Card className="shadow-sm border-red-300 bg-gradient-to-br from-red-50 to-red-100/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Tử vong</span>
                    <Skull className="w-5 h-5 text-red-500" />
                  </div>
                  <span className="font-black text-red-700 text-3xl">{totals.tuVong}</span>
                </CardContent>
              </Card>
            )}
            {/* BTN */}
              <Card className={`shadow-sm ${totalBTN > 0 ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/50' : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">B. Truyền nhiễm</span>
                    <Bug className="w-5 h-5 text-amber-500" />
                  </div>
                  <span className="font-black text-amber-800 text-3xl">{totalBTN}</span>
                  {btnSummary.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {btnSummary.map(d => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 truncate">{d.name}</span>
                          <span className="font-bold text-amber-800 ml-1">{d.bnHienTai}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
          </div>
        </div>
        )}
      </div>{/* end CONTENT */}
    </div>
  );
}
