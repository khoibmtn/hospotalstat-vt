import { useState, useEffect, useCallback, useRef } from 'react';
import { getReportsByDateRange, getReportsByDepartment } from '../services/reportService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { getDiseaseCatalog } from '../services/diseaseCatalogService';
import { getSettings } from '../services/settingsService';
import { aggregateRows } from '../utils/computedColumns';
import { format, parse, subDays, startOfMonth } from 'date-fns';
import { formatDisplayDate } from '../utils/dateUtils';

import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PieChart, CalendarDays } from 'lucide-react';

import KCBOverviewTable from '../components/summary/KCBOverviewTable';
import KCBDetailTable from '../components/summary/KCBDetailTable';
import InfectiousPanel from '../components/summary/InfectiousPanel';
import DeathListPanel from '../components/summary/DeathListPanel';

const DATE_FMT = 'yyyy-MM-dd';

export default function SummaryPage() {
  const today = format(new Date(), DATE_FMT);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), DATE_FMT));
  const [endDate, setEndDate] = useState(today);
  const [departments, setDepartments] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedDept, setSelectedDept] = useState('all');
  const [rawReports, setRawReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [diseaseCatalog, setDiseaseCatalog] = useState([]);
  const [settings, setSettings] = useState({});
  const fetchRef = useRef(0);

  // Load facilities & departments on mount
  useEffect(() => {
    async function loadConfig() {
      const [facs, depts, catalog, sets] = await Promise.all([getFacilities(), getDepartments(), getDiseaseCatalog(), getSettings()]);
      setFacilities(facs);
      setDepartments(depts);
      setDiseaseCatalog(catalog);
      setSettings(sets);
    }
    loadConfig();
  }, []);

  // Auto-fetch when filters change
  const fetchData = useCallback(async () => {
    if (departments.length === 0) return;
    if (!startDate || !endDate) return;

    // Validate date range
    if (endDate < startDate) return;

    const id = ++fetchRef.current;
    setLoading(true);

    try {
      let reports;
      if (selectedDept === 'all') {
        reports = await getReportsByDateRange(startDate, endDate);
      } else {
        reports = await getReportsByDepartment(selectedDept, startDate, endDate);
      }

      // Only set if this is the latest fetch
      if (id === fetchRef.current) {
        setRawReports(reports);
      }
    } catch (err) {
      console.error('Summary fetch error:', err);
    } finally {
      if (id === fetchRef.current) {
        setLoading(false);
      }
    }
  }, [departments.length, selectedDept, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute overview data (group by dept, aggregate)
  const overviewData = (() => {
    if (selectedDept !== 'all') {
      // Single dept → one summary row
      const agg = aggregateRows(rawReports);
      if (!agg || Object.keys(agg).length === 0) return [];
      const dept = departments.find((d) => d.id === selectedDept);
      return [{ departmentId: selectedDept, departmentName: dept?.name || selectedDept, ...agg }];
    }

    // All depts → group by department
    const byDept = {};
    rawReports.forEach((r) => {
      if (!byDept[r.departmentId]) {
        byDept[r.departmentId] = { departmentName: r.departmentName, rows: [] };
      }
      byDept[r.departmentId].rows.push(r);
    });

    return Object.entries(byDept).map(([deptId, data]) => ({
      departmentId: deptId,
      departmentName: data.departmentName,
      ...aggregateRows(data.rows),
    }));
  })();

  const selectedDeptName = selectedDept === 'all'
    ? null
    : departments.find((d) => d.id === selectedDept)?.name || '';

  // Date presets
  function setPreset(preset) {
    const now = new Date();
    switch (preset) {
      case 'today':
        setStartDate(format(now, DATE_FMT));
        setEndDate(format(now, DATE_FMT));
        break;
      case '7days':
        setStartDate(format(subDays(now, 6), DATE_FMT));
        setEndDate(format(now, DATE_FMT));
        break;
      case 'month':
        setStartDate(format(startOfMonth(now), DATE_FMT));
        setEndDate(format(now, DATE_FMT));
        break;
    }
  }

  function handleStartDateChange(val) {
    setStartDate(val);
    // Auto-correct: if end < start, move end
    if (endDate < val) setEndDate(val);
  }

  function handleEndDateChange(val) {
    // Don't allow end < start
    if (val < startDate) return;
    setEndDate(val);
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-3 md:p-6 pb-24 overflow-x-hidden">
      {/* Page header */}
      <div className="mb-4 md:mb-6 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <PieChart className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
          Bảng tổng hợp
        </h1>
      </div>

      {/* Filter bar */}
      <Card className="mb-4 md:mb-6 shadow-sm border-slate-200 shrink-0">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3">
            {/* Row 1: Dept selector + Date inputs */}
            <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
              {/* Department selector */}
              <div className="space-y-1.5 w-full md:w-[220px]">
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Chọn khoa</label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Toàn viện" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🏥 Toàn viện</SelectItem>
                    {facilities.map((f) => (
                      <SelectGroup key={f.id}>
                        <SelectLabel className="bg-slate-50 font-bold text-xs">{f.name}</SelectLabel>
                        {departments
                          .filter((d) => d.facilityId === f.id)
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start date */}
              <div className="space-y-1.5 flex-1 md:flex-none md:w-[160px]">
                <label className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Từ ngày
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-start text-left font-normal text-sm cursor-pointer">
                      <CalendarDays className="mr-2 h-3.5 w-3.5 text-slate-400" />
                      {formatDisplayDate(startDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parse(startDate, 'yyyy-MM-dd', new Date())}
                      onSelect={(d) => d && handleStartDateChange(format(d, 'yyyy-MM-dd'))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End date */}
              <div className="space-y-1.5 flex-1 md:flex-none md:w-[160px]">
                <label className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Đến ngày
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-start text-left font-normal text-sm cursor-pointer">
                      <CalendarDays className="mr-2 h-3.5 w-3.5 text-slate-400" />
                      {formatDisplayDate(endDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parse(endDate, 'yyyy-MM-dd', new Date())}
                      onSelect={(d) => d && handleEndDateChange(format(d, 'yyyy-MM-dd'))}
                      disabled={(d) => d < parse(startDate, 'yyyy-MM-dd', new Date())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Row 2: Presets */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => setPreset('today')}
              >
                Hôm nay
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => setPreset('7days')}
              >
                7 ngày
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => setPreset('month')}
              >
                Tháng này
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs + Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start bg-white border border-slate-200 shadow-sm rounded-lg p-1 h-auto shrink-0">
          <TabsTrigger value="overview" className="text-xs md:text-sm gap-1 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            📊 <span className="hidden sm:inline">Tổng hợp</span> KCB
          </TabsTrigger>
          <TabsTrigger value="detail" className="text-xs md:text-sm gap-1 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            📋 <span className="hidden sm:inline">Chi tiết</span> KCB
          </TabsTrigger>
          <TabsTrigger value="btn" className="text-xs md:text-sm gap-1 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">
            🦠 Bệnh truyền nhiễm
          </TabsTrigger>
          <TabsTrigger value="deathlist" className="text-xs md:text-sm gap-1 data-[state=active]:bg-slate-200 data-[state=active]:text-slate-800">
            ☠️ <span className="hidden sm:inline">Danh sách</span> tử vong
          </TabsTrigger>
        </TabsList>

        <Card className="flex-1 overflow-hidden shadow-sm border-slate-200 flex flex-col bg-white mt-3">
          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            <TabsContent value="overview" className="m-0 flex-1 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <KCBOverviewTable
                data={overviewData}
                rawReports={rawReports}
                loading={loading}
                startDate={startDate}
                endDate={endDate}
                selectedDeptName={selectedDeptName}
              />
            </TabsContent>

            <TabsContent value="detail" className="m-0 flex-1 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <KCBDetailTable
                data={rawReports}
                loading={loading}
                startDate={startDate}
                endDate={endDate}
                isAllDepts={selectedDept === 'all'}
              />
            </TabsContent>

            <TabsContent value="btn" className="m-0 flex-1 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <InfectiousPanel
                reports={rawReports}
                loading={loading}
                selectedDept={selectedDept}
                diseaseCatalog={diseaseCatalog}
              />
            </TabsContent>

            <TabsContent value="deathlist" className="m-0 flex-1 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <DeathListPanel
                reports={rawReports}
                loading={loading}
                columns={settings.deathReportColumns}
              />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
