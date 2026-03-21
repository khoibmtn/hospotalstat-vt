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

export default function DashboardPage() {
  const [todayReports, setTodayReports] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [departments, setDepartments] = useState([]);
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
      <div className="app-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
          <div>Đang tải dashboard...</div>
        </div>
      </div>
    );
  }

  const todayTotals = aggregateRows(todayReports);
  const kpiCards = [
    { label: 'Tổng BN hiện tại', value: todayTotals.bnHienTai, icon: '🏥' },
    { label: 'Vào viện', value: todayTotals.vaoVien, icon: '📥' },
    { label: 'Ra viện', value: todayTotals.raVien, icon: '📤' },
    { label: 'Chuyển đến', value: todayTotals.chuyenDen, icon: '🔄' },
    { label: 'Chuyển đi', value: todayTotals.chuyenDi, icon: '➡️' },
    { label: 'Tử vong', value: todayTotals.tuVong, icon: '⚫' },
  ];

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <h1 className="app-header__title">📊 Dashboard</h1>
        </div>
        <div className="app-header__right">
          <span className="badge badge-info" style={{ padding: '4px 12px' }}>
            Hôm nay: {formatDisplayDate(getToday())}
          </span>
        </div>
      </header>

      <div className="app-content">
        {/* KPI Cards */}
        <div className="kpi-grid">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="kpi-card">
              <span className="kpi-card__label">{kpi.icon} {kpi.label}</span>
              <span className="kpi-card__value">{kpi.value}</span>
            </div>
          ))}
        </div>

        {/* Trend Chart */}
        <div className="chart-container" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="chart-container__title">Xu hướng BN hiện tại (7 ngày)</div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: 'var(--radius-md)', 
                    border: 'none', 
                    boxShadow: 'var(--shadow-md)',
                    backgroundColor: 'var(--surface-card)',
                    color: 'var(--text-primary)'
                  }} 
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="bnHienTai"
                  name="BN hiện tại"
                  stroke="var(--color-primary-500)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="vaoVien"
                  name="Vào viện"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="raVien"
                  name="Ra viện"
                  stroke="var(--color-warning)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Chưa có dữ liệu
            </div>
          )}
        </div>

        {/* Bar Chart by Department */}
        <div className="chart-container" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="chart-container__title">BN hiện tại theo khoa (hôm nay)</div>
          {todayReports.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={todayReports.map((r) => ({
                  name: r.departmentName,
                  bnHienTai: r.bnHienTai || 0,
                }))}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="name" fontSize={11} width={95} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: 'var(--radius-md)', 
                    border: 'none', 
                    boxShadow: 'var(--shadow-md)',
                    backgroundColor: 'var(--surface-card)',
                    color: 'var(--text-primary)'
                  }} 
                />
                <Bar dataKey="bnHienTai" name="BN hiện tại" fill="var(--color-primary-400)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Chưa có dữ liệu
            </div>
          )}
        </div>

        {/* Today's Summary Table */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Bảng tổng hợp hôm nay</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Khoa</th>
                  {INPATIENT_FIELDS.map((f) => (
                    <th key={f.key} className="col-number">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayReports.map((report) => (
                  <tr key={report.id}>
                    <td style={{ fontWeight: 500 }}>{report.departmentName}</td>
                    {INPATIENT_FIELDS.map((f) => (
                      <td key={f.key} className={f.computed ? 'col-computed' : 'col-number'}>
                        {report[f.key] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
                {todayReports.length > 0 && (
                  <tr className="row-total">
                    <td style={{ fontWeight: 700 }}>TỔNG CỘNG</td>
                    {INPATIENT_FIELDS.map((f) => (
                      <td key={f.key} className="col-computed">
                        {todayTotals[f.key] ?? 0}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
