import { useState, useEffect } from 'react';
import { getReportsByDateRange, getReportsByDepartment } from '../services/reportService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { aggregateRows } from '../utils/computedColumns';
import { formatDisplayDate } from '../utils/dateUtils';
import { INPATIENT_FIELDS } from '../utils/constants';
import { format, subDays } from 'date-fns';

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
    <>
      <header className="app-header">
        <div className="app-header__left">
          <h1 className="app-header__title">📋 Bảng tổng hợp</h1>
        </div>
      </header>

      <div className="app-content">
        {/* Filters */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className={`btn ${viewMode === 'hospital' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => {
                  if (viewMode !== 'hospital') {
                    setSummaryData([]);
                    setViewMode('hospital');
                  }
                }}
              >
                Toàn viện
              </button>
              <button
                className={`btn ${viewMode === 'department' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => {
                  if (viewMode !== 'department') {
                    setSummaryData([]);
                    setViewMode('department');
                  }
                }}
              >
                Theo khoa
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Từ ngày</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Đến ngày</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {viewMode === 'department' && (
              <div className="form-group">
                <label className="form-label">Chọn khoa</label>
                <select
                  className="form-input"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="all">—Chọn khoa—</option>
                  {facilities.map((f) => (
                    <optgroup key={f.id} label={f.name}>
                      {departments
                        .filter((d) => d.facilityId === f.id)
                        .map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? '⏳ Đang tải...' : '🔍 Xem'}
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              {viewMode === 'hospital'
                ? `Tổng hợp toàn viện (${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)})`
                : selectedDept === 'all'
                  ? 'Vui lòng chọn một khoa để xem chi tiết'
                  : `Chi tiết ${departments.find((d) => d.id === selectedDept)?.name || ''} (${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)})`}
            </h2>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{viewMode === 'hospital' ? 'Khoa' : 'Ngày'}</th>
                  {INPATIENT_FIELDS.map((f) => (
                    <th key={f.key} className="col-number">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryData.length === 0 ? (
                  <tr>
                    <td colSpan={INPATIENT_FIELDS.length + 1} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      Không có dữ liệu trong khoảng thời gian này
                    </td>
                  </tr>
                ) : (
                  <>
                    {summaryData.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>
                          {viewMode === 'hospital' ? row.departmentName : (row.date ? formatDisplayDate(row.date) : '')}
                        </td>
                        {INPATIENT_FIELDS.map((f) => (
                          <td key={f.key} className={f.computed ? 'col-computed' : 'col-number'}>
                            {row[f.key] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {grandTotals && viewMode === 'hospital' && (
                      <tr className="row-total">
                        <td style={{ fontWeight: 700 }}>TỔNG CỘNG</td>
                        {INPATIENT_FIELDS.map((f) => (
                          <td key={f.key} className="col-computed">
                            {grandTotals[f.key] ?? 0}
                          </td>
                        ))}
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
