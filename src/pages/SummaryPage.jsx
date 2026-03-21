import { useState, useEffect } from 'react';
import { getReportsByDateRange, getReportsByDepartment } from '../services/reportService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { aggregateRows } from '../utils/computedColumns';
import { formatDisplayDate } from '../utils/dateUtils';
import { INPATIENT_FIELDS } from '../utils/constants';
import { format, subDays } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, PieChart, Building2 } from 'lucide-react';

export default function SummaryPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [departments, setDepartments] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedDept, setSelectedDept] = useState('all');
  const [summaryData, setSummaryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('hospital'); // 'hospital' | 'department'

  useEffect(() => {
    async function loadConfig() {
      const [facs, depts] = await Promise.all([getFacilities(), getDepartments()]);
      setFacilities(facs);
      setDepartments(depts);
    }
    loadConfig();
  }, []);

  async function handleSearch() {
    setLoading(true);
    try {
      if (viewMode === 'hospital') {
        const reports = await getReportsByDateRange(startDate, endDate);
        // Group by department, aggregate
        const byDept = {};
        reports.forEach((r) => {
          if (!byDept[r.departmentId]) {
            byDept[r.departmentId] = { departmentName: r.departmentName, rows: [] };
          }
          byDept[r.departmentId].rows.push(r);
        });

        const result = Object.entries(byDept).map(([deptId, data]) => ({
          departmentId: deptId,
          departmentName: data.departmentName,
          ...aggregateRows(data.rows),
          reportCount: data.rows.length,
        }));

        setSummaryData(result);
      } else {
        // Per department — show by date
        if (selectedDept === 'all') {
          setSummaryData([]);
          return;
        }
        const reports = await getReportsByDepartment(selectedDept, startDate, endDate);
        setSummaryData(reports);
      }
    } catch (err) {
      console.error('Summary load error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (departments.length > 0) {
      handleSearch();
    }
  }, [viewMode, departments.length]); // eslint-disable-line

  const grandTotals = summaryData.length > 0 ? aggregateRows(summaryData) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 pb-24 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-blue-600" />
            Bảng tổng hợp
          </h1>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 shadow-sm border-slate-200 shrink-0">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-end flex-wrap gap-4">
            <div className="flex gap-2 w-full md:w-auto">
              <Button
                variant={viewMode === 'hospital' ? 'default' : 'outline'}
                className={`flex-1 md:flex-none ${viewMode === 'hospital' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                onClick={() => {
                  if (viewMode !== 'hospital') {
                    setSummaryData([]);
                    setViewMode('hospital');
                  }
                }}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Toàn viện
              </Button>
              <Button
                variant={viewMode === 'department' ? 'default' : 'outline'}
                className={`flex-1 md:flex-none ${viewMode === 'department' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                onClick={() => {
                  if (viewMode !== 'department') {
                    setSummaryData([]);
                    setViewMode('department');
                  }
                }}
              >
                Theo khoa
              </Button>
            </div>

            <div className="space-y-1.5 flex-1 md:flex-none md:min-w-[150px]">
              <label className="text-xs font-semibold text-slate-500 uppercase">Từ ngày</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5 flex-1 md:flex-none md:min-w-[150px]">
              <label className="text-xs font-semibold text-slate-500 uppercase">Đến ngày</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white"
              />
            </div>

            {viewMode === 'department' && (
              <div className="space-y-1.5 w-full md:w-[220px]">
                <label className="text-xs font-semibold text-slate-500 uppercase">Chọn khoa</label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="— Chọn khoa —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">— Chọn khoa —</SelectItem>
                    {facilities.map((f) => (
                      <SelectGroup key={f.id}>
                        <SelectLabel className="bg-slate-50 font-bold">{f.name}</SelectLabel>
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
            )}

            <Button
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm md:ml-auto"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {loading ? 'Đang tải...' : 'Xem báo cáo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="flex-1 overflow-hidden shadow-sm border-slate-200 flex flex-col bg-white">
        <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <CardTitle className="text-lg font-semibold text-slate-800">
            {viewMode === 'hospital'
              ? `Tổng hợp toàn viện (${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)})`
              : selectedDept === 'all'
                ? 'Vui lòng chọn một khoa để xem chi tiết'
                : `Chi tiết ${departments.find((d) => d.id === selectedDept)?.name || ''} (${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)})`}
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col h-full relative">
          <div className="flex-1 overflow-auto bg-white rounded-b-xl">
            <table className="w-full text-sm text-left border-collapse tabular-nums">
              <thead className="text-xs text-slate-600 uppercase bg-slate-50/95 backdrop-blur sticky top-0 z-20 shadow-sm border-b border-slate-200 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.1)]">
                <tr>
                  <th className="px-4 py-3 font-semibold border-r border-slate-200 sticky left-0 z-30 bg-slate-50 min-w-[150px] shadow-[1px_0_0_0_#e2e8f0]">
                    {viewMode === 'hospital' ? 'Khoa' : 'Ngày'}
                  </th>
                  {INPATIENT_FIELDS.map((f) => (
                    <th key={f.key} className="px-2 py-3 font-semibold border-r border-slate-200 min-w-[70px] text-center">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryData.length === 0 && (
                  <tr>
                    <td colSpan={INPATIENT_FIELDS.length + 1} className="text-center p-12 text-slate-500 font-medium bg-slate-50/30">
                      {loading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu trong khoảng thời gian này'}
                    </td>
                  </tr>
                )}
                {summaryData.length > 0 && summaryData.map((row, idx) => (
                  <tr key={idx} className="group bg-white even:bg-slate-50 border-b border-slate-200 hover:bg-slate-200 transition-colors">
                    <td className="px-4 py-2.5 font-medium border-r border-slate-200 sticky left-0 z-10 tabular-nums whitespace-nowrap text-slate-900 transition-colors shadow-[1px_0_0_0_#e2e8f0] bg-white group-even:bg-slate-50 group-hover:bg-slate-200">
                      {viewMode === 'hospital' ? row.departmentName : (row.date ? formatDisplayDate(row.date) : '')}
                    </td>
                    {INPATIENT_FIELDS.map((f) => (
                      <td key={f.key} className={`px-2 py-2.5 border-r border-slate-100 text-center align-middle ${f.computed ? 'bg-slate-50/50 font-semibold text-slate-700' : ''}`}>
                        {row[f.key] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
                {summaryData.length > 0 && grandTotals && viewMode === 'hospital' && (
                  <tr className="bg-blue-50/50 font-bold border-t-2 border-slate-200 sticky bottom-0 z-20 shadow-[0_-1px_2px_-1px_rgba(0,0,0,0.1)]">
                    <td className="px-4 py-3 border-r border-slate-200 sticky left-0 z-30 bg-blue-50/95 backdrop-blur shadow-[1px_0_0_0_#e2e8f0] whitespace-nowrap text-slate-900 uppercase">
                      TỔNG CỘNG
                    </td>
                    {INPATIENT_FIELDS.map((f) => (
                      <td key={f.key} className="px-2 py-3 border-r border-slate-200 text-center text-blue-700">
                        {grandTotals[f.key] ?? 0}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
