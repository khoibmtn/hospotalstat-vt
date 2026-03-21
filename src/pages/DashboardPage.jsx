import { useState, useEffect } from 'react';
import { getReportsByDate, getReportsByDateRange } from '../services/reportService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { aggregateRows } from '../utils/computedColumns';
import { getToday, formatDisplayDate } from '../utils/dateUtils';
import { INPATIENT_FIELDS } from '../utils/constants';
import { format, subDays } from 'date-fns';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  const [todayReports, setTodayReports] = useState([]);
  const [trendData, setTrendData] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [departments, setDepartments] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [facs, depts] = await Promise.all([getFacilities(), getDepartments()]);
        setFacilities(facs);
        setDepartments(depts);

        const today = getToday();
        const reports = await getReportsByDate(today);
        setTodayReports(reports);

        // Get last 7 days for trend
        const startDate = format(subDays(new Date(), 6), 'yyyy-MM-dd');
        const rangeReports = await getReportsByDateRange(startDate, today);

        // Group by date
        const byDate = {};
        rangeReports.forEach((r) => {
          if (!byDate[r.date]) byDate[r.date] = [];
          byDate[r.date].push(r);
        });

        const trend = Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, reps]) => {
            const agg = aggregateRows(reps);
            return {
              date: formatDisplayDate(date),
              ...agg,
            };
          });

        setTrendData(trend);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-slate-500 animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-500" />
          <div className="font-medium">Đang tải dashboard...</div>
        </div>
      </div>
    );
  }

  const todayTotals = aggregateRows(todayReports);
  const kpiCards = [
    { label: 'Tổng BN hiện tại', value: todayTotals.bnHienTai, icon: '🏥', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Vào viện', value: todayTotals.vaoVien, icon: '📥', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Ra viện', value: todayTotals.raVien, icon: '📤', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Chuyển đến', value: todayTotals.chuyenDen, icon: '🔄', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Chuyển đi', value: todayTotals.chuyenDi, icon: '➡️', color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Tử vong', value: todayTotals.tuVong, icon: '⚫', color: 'text-slate-600', bg: 'bg-slate-100' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 pb-24 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-600" />
            Dashboard
          </h1>
        </div>
        <div className="flex items-center">
          <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 border-blue-100">
            Hôm nay: {formatDisplayDate(getToday())}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 shrink-0">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label} className="shadow-sm border-slate-200 overflow-hidden">
              <CardContent className="p-4 flex flex-col justify-between h-full bg-white">
                <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                    <span className="text-lg leading-none">{kpi.icon}</span>
                  </div>
                </div>
                <div>
                  <span className="text-3xl font-bold tracking-tight text-slate-900">{kpi.value.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
          {/* Trend Chart */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg font-semibold text-slate-800">Xu hướng BN hiện tại (7 ngày)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-white">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" fontSize={12} stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '0.5rem', 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backgroundColor: '#ffffff',
                        color: '#0f172a'
                      }} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Line
                      type="monotone"
                      dataKey="bnHienTai"
                      name="BN hiện tại"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 6, fill: '#2563eb' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="vaoVien"
                      name="Vào viện"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#ffffff' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="raVien"
                      name="Ra viện"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#ffffff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-500 font-medium bg-slate-50/30 rounded-lg">
                  Chưa có dữ liệu xu hướng
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart by Department */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg font-semibold text-slate-800">BN hiện tại theo khoa (Hôm nay)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-white">
              {todayReports.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={todayReports.map((r) => ({
                      name: r.departmentName,
                      bnHienTai: r.bnHienTai || 0,
                    }))}
                    layout="vertical"
                    margin={{ left: 100, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" fontSize={12} stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={95} stroke="#334155" tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ 
                        borderRadius: '0.5rem', 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backgroundColor: '#ffffff',
                        color: '#0f172a'
                      }} 
                    />
                    <Bar dataKey="bnHienTai" name="BN hiện tại" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-500 font-medium bg-slate-50/30 rounded-lg">
                  Chưa có dữ liệu hôm nay
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Today's Summary Table */}
        <Card className="shadow-sm border-slate-200 shrink-0">
          <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg font-semibold text-slate-800">Bảng chi tiết số liệu nội trú theo Khoa (Hôm nay)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 bg-white rounded-b-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse tabular-nums">
                <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold border-r border-slate-200 min-w-[150px]">Khoa</th>
                    {INPATIENT_FIELDS.map((f) => (
                      <th key={f.key} className="px-2 py-3 font-semibold border-r border-slate-200 min-w-[70px] text-center">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayReports.map((report) => (
                    <tr key={report.id} className="bg-white hover:bg-blue-50/40 transition-colors group">
                      <td className="px-4 py-2.5 font-medium border-r border-slate-200 whitespace-nowrap text-slate-900 group-hover:bg-blue-50/40 transition-colors">
                        {report.departmentName}
                      </td>
                      {INPATIENT_FIELDS.map((f) => (
                        <td key={f.key} className={`px-2 py-2.5 border-r border-slate-100 text-center align-middle ${f.computed ? 'bg-slate-50/50 font-semibold text-slate-700' : ''}`}>
                          {report[f.key] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {todayReports.length > 0 && (
                    <tr className="bg-blue-50/50 font-bold border-t-2 border-slate-200">
                      <td className="px-4 py-3 border-r border-slate-200 whitespace-nowrap text-slate-900 uppercase">
                        TỔNG CỘNG
                      </td>
                      {INPATIENT_FIELDS.map((f) => (
                        <td key={f.key} className="px-2 py-3 border-r border-slate-200 text-center text-blue-700">
                          {todayTotals[f.key] ?? 0}
                        </td>
                      ))}
                    </tr>
                  )}
                  {todayReports.length === 0 && (
                    <tr>
                      <td colSpan={INPATIENT_FIELDS.length + 1} className="text-center p-12 text-slate-500 font-medium bg-slate-50/30">
                        Chưa có khoa nào nhập dữ liệu hôm nay
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
