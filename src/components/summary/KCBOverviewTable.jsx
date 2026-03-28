import { INPATIENT_FIELDS } from '../../utils/constants';
import { aggregateGrandTotal } from '../../utils/computedColumns';
import { formatDisplayDate } from '../../utils/dateUtils';
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

export default function KCBOverviewTable({ data, rawReports, loading, startDate, endDate, selectedDeptName }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Đang tải dữ liệu...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="text-4xl mb-3">📊</div>
        <p className="font-medium">Không có dữ liệu trong khoảng thời gian này</p>
      </div>
    );
  }

  const grandTotals = data.length > 1 ? aggregateGrandTotal(rawReports) : null;
  const title = selectedDeptName
    ? `Tổng hợp ${selectedDeptName}`
    : 'Tổng hợp toàn viện';
  const period = `${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)}`;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{period}</p>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left border-collapse tabular-nums">
          <thead className="text-xs text-slate-600 uppercase bg-slate-50/95 backdrop-blur sticky top-0 z-20 border-b border-slate-200">
            <tr>
              <th className="px-3 md:px-4 py-2.5 md:py-3 font-semibold border-r border-slate-200 bg-slate-50 min-w-[100px] md:min-w-[150px]">
                Khoa
              </th>
              {INPATIENT_FIELDS.map((f) => (
                <th key={f.key} className="px-1 md:px-2 py-2.5 md:py-3 font-semibold border-r border-slate-200 min-w-[40px] md:min-w-[70px] text-center">
                  <span className="hidden md:inline">{f.label}</span>
                  <span className="md:hidden">{COMPACT_LABELS[f.key]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, idx) => (
              <tr key={idx} className="group bg-white even:bg-slate-50/50 hover:bg-slate-100 transition-colors">
                <td className="px-3 md:px-4 py-2 md:py-2.5 font-medium border-r border-slate-200 text-slate-900 text-xs md:text-sm whitespace-nowrap">
                  {row.departmentName}
                </td>
                {INPATIENT_FIELDS.map((f) => (
                  <td
                    key={f.key}
                    className={`px-1 md:px-2 py-2 md:py-2.5 border-r border-slate-100 text-center text-xs md:text-sm tabular-nums ${
                      f.computed ? 'bg-slate-50/50 font-semibold text-slate-700' : ''
                    }`}
                  >
                    {row[f.key] ?? 0}
                  </td>
                ))}
              </tr>
            ))}

            {grandTotals && (
              <tr className="bg-blue-50/50 font-bold border-t-2 border-slate-300 sticky bottom-0 z-20">
                <td className="px-3 md:px-4 py-2.5 md:py-3 border-r border-slate-200 bg-blue-50/95 backdrop-blur text-slate-900 uppercase text-xs md:text-sm">
                  TỔNG CỘNG
                </td>
                {INPATIENT_FIELDS.map((f) => (
                  <td key={f.key} className="px-1 md:px-2 py-2.5 md:py-3 border-r border-slate-200 text-center text-blue-700 text-xs md:text-sm">
                    {grandTotals[f.key] ?? 0}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
