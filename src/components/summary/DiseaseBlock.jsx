import { useMemo } from 'react';
import { INPATIENT_FIELDS } from '../../utils/constants';
import { formatDisplayDate } from '../../utils/dateUtils';
import { aggregateDeptSummaries } from '../../utils/computedColumns';

const COMPACT_LABELS = {
  bnCu: 'Cũ',
  vaoVien: 'Vào',
  chuyenDen: 'Đến',
  chuyenDi: 'Đi',
  raVien: 'Ra',
  tuVong: 'TV',
  chuyenVien: 'CV',
  bnHienTai: 'HT',
};

export default function DiseaseBlock({ diseaseName, rows, mode, departments }) {
  // Calculate header summary totals
  const headerTotals = useMemo(() => {
    const totals = aggregateDeptSummaries(rows);
    return totals;
  }, [rows]);

  // Prepare table rows based on mode
  const tableRows = useMemo(() => {
    if (mode === 'summary') {
      // Group by department, aggregate
      const byDept = {};
      rows.forEach((r) => {
        const deptId = r.departmentId || r._departmentId;
        const deptName = r.departmentName || r._departmentName || deptId;
        if (!byDept[deptId]) byDept[deptId] = { departmentName: deptName, items: [] };
        byDept[deptId].items.push(r);
      });

      return Object.entries(byDept).map(([deptId, data]) => {
        const agg = aggregateDeptSummaries(data.items);
        return { label: data.departmentName, ...agg };
      });
    }

    // detail mode — group by date
    const byDate = {};
    rows.forEach((r) => {
      const date = r._date || r.date;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(r);
    });

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => {
        const agg = aggregateDeptSummaries(items);
        return { label: formatDisplayDate(date), ...agg };
      });
  }, [rows, mode]);

  const totalHT = Number(headerTotals.bnHienTai) || 0;
  const totalVao = Number(headerTotals.vaoVien) || 0;
  const totalRa = Number(headerTotals.raVien) || 0;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Disease header with summary stats */}
      <div className="px-3 md:px-4 py-2.5 md:py-3 bg-amber-50/80 border-b border-amber-200/60 flex flex-wrap items-center gap-2 md:gap-4">
        <span className="font-semibold text-sm md:text-base text-slate-800 flex items-center gap-1.5">
          🦠 {diseaseName}
        </span>
        <div className="flex gap-2 md:gap-3 text-xs md:text-sm text-slate-600 ml-auto">
          <span>HT: <strong className="text-slate-800">{totalHT}</strong></span>
          <span>Vào: <strong className="text-emerald-700">{totalVao}</strong></span>
          <span>Ra: <strong className="text-blue-700">{totalRa}</strong></span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-xs md:text-sm text-left border-collapse tabular-nums">
          <thead className="text-[10px] md:text-xs text-slate-600 uppercase bg-slate-50/80 border-b border-slate-200">
            <tr>
              <th className="px-2 md:px-3 py-2 font-semibold border-r border-slate-200 min-w-[80px] md:min-w-[120px]">
                {mode === 'summary' ? 'Khoa' : 'Ngày'}
              </th>
              {INPATIENT_FIELDS.map((f) => (
                <th key={f.key} className="px-1 md:px-2 py-2 font-semibold border-r border-slate-200 min-w-[36px] md:min-w-[56px] text-center">
                  <span className="hidden md:inline">{f.label}</span>
                  <span className="md:hidden">{COMPACT_LABELS[f.key]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={INPATIENT_FIELDS.length + 1} className="text-center py-6 text-slate-400 text-sm">
                  Không có dữ liệu
                </td>
              </tr>
            )}
            {tableRows.map((row, idx) => (
              <tr key={idx} className="bg-white even:bg-slate-50/30 hover:bg-slate-100 transition-colors">
                <td className="px-2 md:px-3 py-1.5 md:py-2 font-medium border-r border-slate-200 text-slate-800 whitespace-nowrap">
                  {row.label}
                </td>
                {INPATIENT_FIELDS.map((f) => (
                  <td
                    key={f.key}
                    className={`px-1 md:px-2 py-1.5 md:py-2 border-r border-slate-100 text-center tabular-nums ${
                      f.computed ? 'font-semibold text-slate-700' : ''
                    }`}
                  >
                    {row[f.key] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
