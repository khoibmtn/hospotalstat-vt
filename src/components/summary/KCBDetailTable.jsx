import { useState, useMemo } from 'react';
import { INPATIENT_FIELDS } from '../../utils/constants';
import { formatDisplayDate } from '../../utils/dateUtils';
import { aggregateDeptSummaries } from '../../utils/computedColumns';
import { Loader2 } from 'lucide-react';

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

export default function KCBDetailTable({ data, loading, startDate, endDate, isAllDepts }) {
  const [showShift, setShowShift] = useState(false);

  // For "toàn viện" mode, aggregate all depts per date
  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!isAllDepts) return [...data].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const byDate = {};
    data.forEach((r) => {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r);
    });

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, reports]) => ({
        date,
        ...aggregateDeptSummaries(reports),
        _isAggregate: true,
      }));
  }, [data, isAllDepts]);

  // Calculate diff from previous row's bnHienTai
  const rowsWithDiff = useMemo(() => {
    return rows.map((row, idx) => {
      if (idx === 0) return { ...row, _diff: null };
      const prev = Number(rows[idx - 1].bnHienTai) || 0;
      const curr = Number(row.bnHienTai) || 0;
      return { ...row, _diff: curr - prev };
    });
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Đang tải dữ liệu...
      </div>
    );
  }

  if (rowsWithDiff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="text-4xl mb-3">📋</div>
        <p className="font-medium">Không có dữ liệu chi tiết</p>
      </div>
    );
  }

  const period = `${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)}`;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Chi tiết theo ngày</h3>
          <p className="text-xs text-slate-500 mt-0.5">{period}</p>
        </div>
        {!isAllDepts && (
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showShift}
              onChange={(e) => setShowShift(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Hiển thị tua trực
          </label>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left border-collapse tabular-nums">
          <thead className="text-xs text-slate-600 uppercase bg-slate-50/95 backdrop-blur sticky top-0 z-20 border-b border-slate-200">
            <tr>
              <th className="px-3 md:px-4 py-2.5 md:py-3 font-semibold border-r border-slate-200 bg-slate-50 min-w-[80px] md:min-w-[100px]">
                Ngày
              </th>
              {showShift && !isAllDepts && (
                <th className="px-2 md:px-3 py-2.5 md:py-3 font-semibold border-r border-slate-200 min-w-[100px] md:min-w-[140px]">
                  <span className="hidden md:inline">Tua trực</span>
                  <span className="md:hidden">Tua</span>
                </th>
              )}
              {INPATIENT_FIELDS.map((f) => (
                <th key={f.key} className="px-1 md:px-2 py-2.5 md:py-3 font-semibold border-r border-slate-200 min-w-[40px] md:min-w-[70px] text-center">
                  <span className="hidden md:inline">{f.label}</span>
                  <span className="md:hidden">{COMPACT_LABELS[f.key]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rowsWithDiff.map((row, idx) => (
              <tr key={idx} className="group bg-white even:bg-slate-50/50 hover:bg-slate-100 transition-colors">
                <td className="px-3 md:px-4 py-2 md:py-2.5 font-medium border-r border-slate-200 text-slate-900 text-xs md:text-sm whitespace-nowrap">
                  {row.date ? formatDisplayDate(row.date) : ''}
                </td>
                {showShift && !isAllDepts && (
                  <td className="px-2 md:px-3 py-2 md:py-2.5 border-r border-slate-200 text-xs md:text-sm text-slate-600 truncate max-w-[140px]">
                    {row.shiftName || '—'}
                  </td>
                )}
                {INPATIENT_FIELDS.map((f) => {
                  const val = row[f.key] ?? 0;
                  const isHT = f.key === 'bnHienTai';
                  const diff = isHT ? row._diff : null;

                  return (
                    <td
                      key={f.key}
                      className={`px-1 md:px-2 py-2 md:py-2.5 border-r border-slate-100 text-center text-xs md:text-sm tabular-nums ${
                        f.computed ? 'bg-slate-50/50 font-semibold text-slate-700' : ''
                      }`}
                    >
                      {val}
                      {diff !== null && diff !== 0 && (
                        <span className={`ml-0.5 text-[10px] md:text-xs font-medium ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          ({diff > 0 ? '+' : ''}{diff})
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
