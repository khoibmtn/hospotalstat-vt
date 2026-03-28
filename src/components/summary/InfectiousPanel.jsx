import { useState, useMemo } from 'react';
import DiseaseBlock from './DiseaseBlock';
import { Loader2 } from 'lucide-react';

/**
 * Group reports' infectiousData by disease name.
 * Attaches _departmentId, _departmentName, _date to each disease row for aggregation.
 */
function groupByDisease(reports) {
  const map = {};
  reports.forEach((r) => {
    if (!r.infectiousData || !Array.isArray(r.infectiousData)) return;
    r.infectiousData.forEach((d) => {
      if (!d.diseaseName) return;
      if (!map[d.diseaseName]) map[d.diseaseName] = [];
      map[d.diseaseName].push({
        ...d,
        _departmentId: r.departmentId,
        _departmentName: r.departmentName,
        _date: r.date,
      });
    });
  });
  return map;
}

/**
 * Calculate total bnHienTai for a disease across all rows
 */
function totalHT(rows) {
  // Get the latest date's data, summed across depts
  const byDate = {};
  rows.forEach((r) => {
    const date = r._date || '';
    if (!byDate[date]) byDate[date] = 0;
    byDate[date] += Number(r.bnHienTai) || 0;
  });
  const dates = Object.keys(byDate).sort();
  return dates.length > 0 ? byDate[dates[dates.length - 1]] : 0;
}

export default function InfectiousPanel({ reports, loading, selectedDept, diseaseCatalog }) {
  const [mode, setMode] = useState('summary'); // 'summary' | 'detail'
  const [selectedDiseases, setSelectedDiseases] = useState(null); // null = all

  const grouped = useMemo(() => groupByDisease(reports || []), [reports]);

  // Build catalog order map for sorting
  const catalogOrderMap = useMemo(() => {
    const m = {};
    (diseaseCatalog || []).forEach((d, i) => { m[d.name] = d.order ?? (i + 1); });
    return m;
  }, [diseaseCatalog]);

  // Get diseases that have at least some data, sorted by catalog order
  const activeDiseases = useMemo(() => {
    return Object.entries(grouped)
      .filter(([, rows]) => rows.some((r) =>
        (Number(r.bnHienTai) || 0) > 0 ||
        (Number(r.vaoVien) || 0) > 0 ||
        (Number(r.bnCu) || 0) > 0
      ))
      .sort(([a], [b]) => (catalogOrderMap[a] ?? 999) - (catalogOrderMap[b] ?? 999))
      .map(([name]) => name);
  }, [grouped, catalogOrderMap]);

  // Which diseases to actually show
  const visibleDiseases = useMemo(() => {
    if (!selectedDiseases) return activeDiseases;
    return activeDiseases.filter((d) => selectedDiseases.includes(d));
  }, [activeDiseases, selectedDiseases]);

  function toggleDisease(name) {
    setSelectedDiseases((prev) => {
      const current = prev || [...activeDiseases];
      if (current.includes(name)) {
        const next = current.filter((d) => d !== name);
        return next.length === 0 ? null : next;
      }
      return [...current, name];
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Đang tải dữ liệu...
      </div>
    );
  }

  if (activeDiseases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="text-4xl mb-3">🦠</div>
        <p className="font-medium">Không có dữ liệu bệnh truyền nhiễm</p>
        <p className="text-sm mt-1">Trong khoảng thời gian này chưa ghi nhận ca bệnh nào</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter & mode controls */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 space-y-3">
        {/* Disease filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {activeDiseases.map((name) => {
            const isSelected = !selectedDiseases || selectedDiseases.includes(name);
            return (
              <button
                key={name}
                onClick={() => toggleDisease(name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  isSelected
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                }`}
              >
                {isSelected ? '✓ ' : ''}{name}
              </button>
            );
          })}
        </div>

        {/* Mode radio */}
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="radio"
              name="btnMode"
              checked={mode === 'summary'}
              onChange={() => setMode('summary')}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-700">Tổng hợp</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="radio"
              name="btnMode"
              checked={mode === 'detail'}
              onChange={() => setMode('detail')}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-700">Chi tiết theo ngày</span>
          </label>
        </div>
      </div>

      {/* Disease blocks */}
      <div className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4">
        {/* Aggregate all diseases */}
        {visibleDiseases.length > 0 && (() => {
          const allRows = visibleDiseases.flatMap((name) => grouped[name] || []);
          return (
            <DiseaseBlock
              diseaseName="Tổng hợp tất cả Bệnh truyền nhiễm"
              rows={allRows}
              mode={mode}
              isAggregate
            />
          );
        })()}

        {visibleDiseases.map((name) => (
          <DiseaseBlock
            key={name}
            diseaseName={name}
            rows={grouped[name]}
            mode={mode}
          />
        ))}

        {visibleDiseases.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            Chọn ít nhất 1 bệnh để hiển thị
          </div>
        )}
      </div>
    </div>
  );
}
