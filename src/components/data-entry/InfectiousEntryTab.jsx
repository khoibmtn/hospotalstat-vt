import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { INPATIENT_FIELDS, REPORT_STATUS } from '../../utils/constants';
import { formatDisplayDate, shouldAutoLock } from '../../utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Plus, X, Search, Loader2, TrendingUp, Users, LogIn, LogOut, Lock, Unlock } from 'lucide-react';

export default function InfectiousEntryTab({
  monthReports,
  daysInMonth,
  detailDate,
  diseaseCatalog,
  settings,
  canEdit,
  onDiseaseChange,
  onAddDisease,
  onRemoveDisease,
  onAutoSave,
  onKeyDown,
  dataLoading,
}) {
  const [selectedDiseases, setSelectedDiseases] = useState(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeDate, setActiveDate] = useState(detailDate);

  // Sync activeDate to a valid day in the current month
  useEffect(() => {
    if (!daysInMonth.includes(activeDate)) {
      setActiveDate(daysInMonth.includes(detailDate) ? detailDate : daysInMonth[0]);
    }
  }, [daysInMonth, activeDate, detailDate]);
  const todayRowRef = useRef(null);
  const firstInputRef = useRef(null);
  const chipBarRef = useRef(null);

  const isMultiSelect = selectedDiseases.size > 1;

  // ───── Visible diseases: union of month data + carry-over ─────
  const visibleDiseases = useMemo(() => {
    const nameSet = new Set();
    daysInMonth.forEach(d => {
      (monthReports[d]?.infectiousData || []).forEach(r => {
        if (r.diseaseName) nameSet.add(r.diseaseName);
      });
    });
    return [...nameSet];
  }, [daysInMonth, monthReports]);

  // ───── Color map from catalog ─────
  const diseaseColorMap = useMemo(() => {
    const map = {};
    diseaseCatalog.forEach(d => { if (d.color) map[d.name] = d.color; });
    return map;
  }, [diseaseCatalog]);

  // ───── Catalog order map for consistent ordering ─────
  const catalogOrderMap = useMemo(() => {
    const m = {};
    diseaseCatalog.forEach((d, i) => { m[d.name] = d.order ?? (i + 1); });
    return m;
  }, [diseaseCatalog]);

  // ───── Sort chips: 🟢 active (catalog order) → 🟡 has data (catalog order) → ⚪ new ─────
  const sortedDiseases = useMemo(() => {
    const lastDayWithData = (name) => {
      for (let i = daysInMonth.length - 1; i >= 0; i--) {
        const entry = (monthReports[daysInMonth[i]]?.infectiousData || []).find(r => r.diseaseName === name);
        if (entry) return entry;
      }
      return null;
    };

    return [...visibleDiseases].sort((a, b) => {
      const entryA = lastDayWithData(a);
      const entryB = lastDayWithData(b);
      const htA = entryA?.bnHienTai || 0;
      const htB = entryB?.bnHienTai || 0;
      if (htA > 0 && htB <= 0) return -1;
      if (htA <= 0 && htB > 0) return 1;
      // Within same priority group, sort by catalog order
      return (catalogOrderMap[a] ?? 999) - (catalogOrderMap[b] ?? 999);
    });
  }, [visibleDiseases, daysInMonth, monthReports, catalogOrderMap]);

  // ───── Default selection: first disease ─────
  useEffect(() => {
    if (selectedDiseases.size === 0 || !visibleDiseases.some(d => selectedDiseases.has(d))) {
      if (sortedDiseases.length > 0) {
        setSelectedDiseases(new Set([sortedDiseases[0]]));
      } else {
        setSelectedDiseases(new Set());
      }
    }
  }, [sortedDiseases, visibleDiseases, selectedDiseases]);

  // ───── Chip click handler (toggle multi-select) ─────
  const handleChipClick = useCallback((name, e) => {
    if (e.ctrlKey || e.metaKey) {
      // Multi-select toggle
      setSelectedDiseases(prev => {
        const next = new Set(prev);
        if (next.has(name)) {
          if (next.size > 1) next.delete(name);
        } else {
          next.add(name);
        }
        return next;
      });
    } else {
      // Single select
      setSelectedDiseases(new Set([name]));
    }
  }, []);

  // ───── Select all / deselect all ─────
  const handleSelectAll = useCallback(() => {
    if (selectedDiseases.size === visibleDiseases.length) {
      // Deselect all → keep first
      setSelectedDiseases(new Set([sortedDiseases[0]]));
    } else {
      setSelectedDiseases(new Set(visibleDiseases));
    }
  }, [selectedDiseases, visibleDiseases, sortedDiseases]);

  const getChipBnHienTai = useCallback((name) => {
    for (let i = daysInMonth.length - 1; i >= 0; i--) {
      const entry = (monthReports[daysInMonth[i]]?.infectiousData || []).find(r => r.diseaseName === name);
      if (entry) return entry.bnHienTai || 0;
    }
    return 0;
  }, [daysInMonth, monthReports]);

  // ───── The single selected disease (for editing) ─────
  const singleSelectedDisease = isMultiSelect ? null : [...selectedDiseases][0] || '';

  // ───── Quick stats (smart last-entry lookup) ─────
  const stats = useMemo(() => {
    const diseases = [...selectedDiseases];
    if (diseases.length === 0) return null;

    let totalBnDauThang = 0, totalSumVao = 0, totalSumRa = 0, totalBnHienTai = 0;

    diseases.forEach(diseaseName => {
      const diseaseRows = daysInMonth
        .map(d => ({ date: d, row: (monthReports[d]?.infectiousData || []).find(r => r.diseaseName === diseaseName) }))
        .filter(x => x.row);

      if (diseaseRows.length > 0) {
        totalBnDauThang += diseaseRows[0].row.bnCu || 0;
        totalBnHienTai += diseaseRows[diseaseRows.length - 1].row.bnHienTai || 0;
        diseaseRows.forEach(({ row }) => {
          totalSumVao += (row.vaoVien || 0);
          totalSumRa += (row.raVien || 0);
        });
      }
    });

    return { bnDauThang: totalBnDauThang, sumVao: totalSumVao, sumRa: totalSumRa, bnHienTai: totalBnHienTai };
  }, [monthReports, daysInMonth, selectedDiseases]);

  // ───── Timeline rows (aggregated when multi-select) ─────
  const timelineRows = useMemo(() => {
    const diseases = [...selectedDiseases];
    if (diseases.length === 0) return [];

    return daysInMonth.map(dateStr => {
      const report = monthReports[dateStr] || {};
      const explicitlyLocked = report.status === REPORT_STATUS.LOCKED;
      const explicitlyUnlocked = report.status === REPORT_STATUS.UNLOCKED;
      const autoLocked = settings?.autoLockEnabled && shouldAutoLock(dateStr, settings.autoLockHour) && !explicitlyUnlocked;
      const isLocked = explicitlyLocked || autoLocked;
      const editable = canEdit(report, dateStr);

      if (isMultiSelect) {
        // Aggregate across all selected diseases
        let hasAnyEntry = false;
        const agg = { bnCu: 0, vaoVien: 0, chuyenDen: 0, chuyenDi: 0, raVien: 0, tuVong: 0, chuyenVien: 0, bnHienTai: 0 };
        diseases.forEach(name => {
          const entry = (report.infectiousData || []).find(r => r.diseaseName === name);
          if (entry) {
            hasAnyEntry = true;
            INPATIENT_FIELDS.forEach(f => { agg[f.key] = (agg[f.key] || 0) + (entry[f.key] || 0); });
          }
        });
        return { dateStr, entry: hasAnyEntry ? agg : null, idx: -1, editable: false, hasEntry: hasAnyEntry, report, isLocked, explicitlyLocked, autoLocked };
      } else {
        const entry = (report.infectiousData || []).find(r => r.diseaseName === singleSelectedDisease);
        const idx = entry ? (report.infectiousData || []).indexOf(entry) : -1;
        return { dateStr, entry, idx, editable, hasEntry: !!entry, report, isLocked, explicitlyLocked, autoLocked };
      }
    });
  }, [daysInMonth, monthReports, selectedDiseases, singleSelectedDisease, isMultiSelect, canEdit, settings]);

  // ───── Totals row ─────
  const totals = useMemo(() => {
    const defaults = { bnCu: 0, vaoVien: 0, chuyenDen: 0, chuyenDi: 0, raVien: 0, tuVong: 0, chuyenVien: 0, bnHienTai: 0 };
    if (timelineRows.length === 0) return defaults;

    const rowsWithData = timelineRows.filter(r => r.hasEntry);
    if (rowsWithData.length === 0) return defaults;

    let sumVao = 0, sumChuyenDen = 0, sumChuyenDi = 0, sumRa = 0, sumTuVong = 0, sumChuyenVien = 0;
    rowsWithData.forEach(r => {
      sumVao += r.entry.vaoVien || 0;
      sumChuyenDen += r.entry.chuyenDen || 0;
      sumChuyenDi += r.entry.chuyenDi || 0;
      sumRa += r.entry.raVien || 0;
      sumTuVong += r.entry.tuVong || 0;
      sumChuyenVien += r.entry.chuyenVien || 0;
    });

    return {
      bnCu: rowsWithData[0].entry.bnCu || 0,
      vaoVien: sumVao,
      chuyenDen: sumChuyenDen,
      chuyenDi: sumChuyenDi,
      raVien: sumRa,
      tuVong: sumTuVong,
      chuyenVien: sumChuyenVien,
      bnHienTai: rowsWithData[rowsWithData.length - 1].entry.bnHienTai || 0,
    };
  }, [timelineRows]);

  // ───── Add disease handler ─────
  const handleAddNewDisease = (diseaseName) => {
    if (!diseaseName || !detailDate) return;
    const todayReport = monthReports[detailDate] || {};
    const alreadyExists = (todayReport.infectiousData || []).some(d => d.diseaseName === diseaseName);
    if (alreadyExists) return;

    onAddDisease(detailDate);
    setTimeout(() => {
      const report = monthReports[detailDate] || {};
      const newIdx = (report.infectiousData || []).length;
      onDiseaseChange(detailDate, newIdx, 'diseaseName', diseaseName);
      onAutoSave(detailDate);
      setSelectedDiseases(new Set([diseaseName]));
      setAddDialogOpen(false);
      setTimeout(() => {
        todayRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInputRef.current?.focus();
      }, 100);
    }, 50);
  };

  // ───── Diseases available for adding (not already visible in month) ─────
  const availableToAdd = useMemo(() => {
    const visible = new Set(visibleDiseases);
    return diseaseCatalog.filter(d => !visible.has(d.name));
  }, [diseaseCatalog, visibleDiseases]);

  const availableGroupA = useMemo(() => availableToAdd.filter(d => d.group === 'A'), [availableToAdd]);
  const availableGroupB = useMemo(() => availableToAdd.filter(d => d.group !== 'A'), [availableToAdd]);

  // ───── Check if disease has any data in the month ─────
  const diseaseHasData = useCallback((diseaseName) => {
    return daysInMonth.some(d => {
      const entries = monthReports[d]?.infectiousData || [];
      const entry = entries.find(e => e.diseaseName === diseaseName);
      if (!entry) return false;
      return (Number(entry.bnCu) || 0) > 0 ||
        (Number(entry.vaoVien) || 0) > 0 ||
        (Number(entry.chuyenDen) || 0) > 0 ||
        (Number(entry.raVien) || 0) > 0 ||
        (Number(entry.tuVong) || 0) > 0 ||
        (Number(entry.chuyenVien) || 0) > 0 ||
        (Number(entry.chuyenDi) || 0) > 0 ||
        (Number(entry.bnHienTai) || 0) > 0;
    });
  }, [daysInMonth, monthReports]);

  // ───── Remove disease from all days in month ─────
  const handleRemoveDiseaseCard = useCallback((diseaseName) => {
    if (diseaseHasData(diseaseName)) return;
    // Remove from every day's infectiousData
    daysInMonth.forEach(d => {
      const entries = monthReports[d]?.infectiousData || [];
      const idx = entries.findIndex(e => e.diseaseName === diseaseName);
      if (idx >= 0) {
        onRemoveDisease(d, idx);
        onAutoSave(d);
      }
    });
    setSelectedDiseases(prev => {
      const next = new Set(prev);
      next.delete(diseaseName);
      if (next.size === 0 && sortedDiseases.length > 1) {
        const remaining = sortedDiseases.filter(n => n !== diseaseName);
        if (remaining.length > 0) next.add(remaining[0]);
      }
      return next;
    });
  }, [diseaseHasData, daysInMonth, monthReports, onRemoveDisease, onAutoSave, sortedDiseases]);

  // ───── Scroll to active chip ─────
  useEffect(() => {
    if (selectedDiseases.size === 1 && chipBarRef.current) {
      const activeChip = chipBarRef.current.querySelector('[data-active="true"]');
      if (activeChip) {
        activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDiseases]);

  // ───── Loading skeleton ─────
  if (dataLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="flex gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-9 w-28 bg-slate-200 rounded-full" />)}
        </div>
        <div className="h-20 bg-slate-100 rounded-lg" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-slate-100 rounded" />)}
        </div>
      </div>
    );
  }

  // ───── Empty state ─────
  if (visibleDiseases.length === 0 && !addDialogOpen) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">🦠</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Chưa có bệnh truyền nhiễm trong tháng này</h3>
        <p className="text-sm text-slate-500 mb-6 max-w-sm">Thêm bệnh mới để bắt đầu theo dõi diễn biến bệnh truyền nhiễm.</p>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Thêm bệnh mới
        </Button>
        {addDialogOpen && renderAddDialog()}
      </div>
    );
  }

  function renderAddDialog() {
    return (
      <InlineDiseaseSearch
        availableGroupA={availableGroupA}
        availableGroupB={availableGroupB}
        availableToAdd={availableToAdd}
        onSelect={(val) => handleAddNewDisease(val)}
        onClose={() => setAddDialogOpen(false)}
      />
    );
  }

  const getDiseaseColor = (name) => diseaseColorMap[name] || '#6b7280';

  const allSelected = selectedDiseases.size === visibleDiseases.length && visibleDiseases.length > 1;

  return (
    <div className="flex flex-col h-full">
      {/* ───── Add Disease Modal (rendered at root level, fixed overlay) ───── */}
      {addDialogOpen && renderAddDialog()}

      {/* ───── Disease Chips Bar ───── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-1 pt-0.5" ref={chipBarRef}>
          {/* Select all chip */}
          {visibleDiseases.length > 1 && (
            <button
              onClick={handleSelectAll}
              className={`
                inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap transition-all shrink-0
                ${allSelected
                  ? 'bg-teal-600 text-white border-teal-600 ring-2 ring-offset-1 ring-teal-400 shadow-sm'
                  : 'bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100'}
              `}
            >
              Tất cả ({visibleDiseases.length})
            </button>
          )}

          {sortedDiseases.map(name => {
            const isActive = selectedDiseases.has(name);
            const ht = getChipBnHienTai(name);
            return (
              <button
                key={name}
                data-active={isActive}
                onClick={(e) => handleChipClick(name, e)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
                }`}
                title="Ctrl/Cmd+Click để chọn nhiều"
              >
                {isActive ? '✓ ' : ''}{name}
                {ht > 0 && (
                  <span className="ml-1 text-[10px] font-bold">{ht}</span>
                )}
                {!diseaseHasData(name) && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveDiseaseCard(name); }}
                    className="ml-0.5 rounded-full hover:bg-red-200/60 p-0.5 text-current opacity-50 hover:opacity-100 transition-opacity"
                    title="Xóa bệnh"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}

          {/* Add disease button */}
          <button
            onClick={() => setAddDialogOpen(!addDialogOpen)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-teal-400 text-teal-600 hover:bg-teal-50 whitespace-nowrap transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm bệnh
          </button>
        </div>

        {/* Multi-select indicator */}
        {isMultiSelect && (
          <div className="mt-2 flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-md">
            <span className="font-semibold">📊 Chế độ xem tổng hợp</span>
            <span>— {selectedDiseases.size} bệnh được chọn. Nhập liệu tắt.</span>
            <button onClick={() => setSelectedDiseases(new Set([sortedDiseases[0]]))} className="ml-auto text-teal-600 hover:text-teal-800 font-medium underline">
              Quay về 1 bệnh
            </button>
          </div>
        )}
      </div>

      {selectedDiseases.size > 0 && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* ───── Quick Stats Card ───── */}
          {stats && (
            <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
              <StatCard icon={<Users className="w-4 h-4" />} label="BN đầu tháng" value={stats.bnDauThang} color="indigo" />
              <StatCard icon={<LogIn className="w-4 h-4" />} label="Vào viện (tháng)" value={stats.sumVao} color="sky" />
              <StatCard icon={<LogOut className="w-4 h-4" />} label="Ra viện (tháng)" value={stats.sumRa} color="orange" />
              <StatCard icon={<TrendingUp className="w-4 h-4" />} label="BN hiện tại" value={stats.bnHienTai} color="emerald" highlight />
            </div>
          )}

          {/* ───── Timeline Table ───── */}
          <div className="flex-1 overflow-auto mx-4 mb-4 rounded-lg border border-slate-200">
            <table className="w-full text-sm border-collapse tabular-nums min-w-[800px]">
              <thead className="text-[11px] text-white uppercase bg-teal-700 sticky top-0 z-20 shadow-md">
                <tr>
                  <th className="w-10 px-1 py-2.5 text-center sticky left-0 z-30 bg-teal-700" />
                  <th className="px-3 py-2.5 font-semibold text-left sticky left-[40px] z-30 bg-teal-700 min-w-[100px] shadow-[2px_0_0_0_#0f766e]">Ngày</th>
                  <th className="px-3 py-2.5 font-semibold text-left bg-teal-700 min-w-[120px]">Tua trực</th>
                  {INPATIENT_FIELDS.map(f => (
                    <th key={f.key} className="px-2 py-2.5 font-semibold text-center min-w-[70px]">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timelineRows.map(({ dateStr, entry, idx, editable, hasEntry, isLocked, explicitlyLocked, autoLocked, report }) => {
                  const isActiveRow = dateStr === activeDate;
                  const canEditRow = editable && !isMultiSelect;

                  return (
                    <tr
                      key={dateStr}
                      ref={isActiveRow ? todayRowRef : undefined}
                      onClick={() => setActiveDate(dateStr)}
                      className={`
                        transition-colors group
                        ${canEditRow && isActiveRow
                          ? 'bg-blue-50/30 relative'
                          : canEditRow
                            ? 'bg-yellow-50/50 hover:bg-yellow-100/50 focus-within:bg-blue-100 focus-within:hover:bg-blue-100'
                            : hasEntry
                              ? 'bg-white even:bg-slate-50/50'
                              : 'bg-slate-50/30'
                        }
                      `}
                    >
                      {/* Lock status icon */}
                      <td 
                        className={`w-10 px-1 py-2 text-center sticky left-0 z-10 ${canEditRow && isActiveRow ? 'bg-blue-50' : canEditRow ? 'bg-[#fffbeb] group-hover:bg-[#fef3c7] group-focus-within:bg-blue-100' : hasEntry ? 'bg-white' : 'bg-slate-50/30'}`}
                        style={canEditRow && isActiveRow ? { boxShadow: 'inset 2px 0 0 0 #60a5fa, inset 0 2px 0 0 #60a5fa, inset 0 -2px 0 0 #60a5fa' } : {}}
                      >
                        <div
                          className={`mx-auto flex items-center justify-center w-6 h-6 rounded-sm transition-colors ${
                            explicitlyLocked ? 'text-slate-400'
                              : autoLocked ? 'text-orange-400'
                              : 'text-blue-400'
                          }`}
                          title={explicitlyLocked ? "Đã khóa (Thủ công)" : autoLocked ? "Khóa tự động" : "Đang mở"}
                        >
                          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </div>
                      </td>
                      <td 
                        className={`px-3 py-2 font-medium whitespace-nowrap sticky left-[40px] z-10 shadow-[1px_0_0_0_#e2e8f0] ${canEditRow && isActiveRow ? 'bg-blue-50' : canEditRow ? 'bg-[#fffbeb] group-hover:bg-[#fef3c7] group-focus-within:bg-blue-100 group-focus-within:hover:bg-blue-100' : hasEntry ? 'bg-white' : 'bg-slate-50/30'}`}
                        style={canEditRow && isActiveRow ? { boxShadow: 'inset 0 2px 0 0 #60a5fa, inset 0 -2px 0 0 #60a5fa, 1px 0 0 0 #e2e8f0' } : {}}
                      >
                        <div className="flex items-center gap-2">
                          <span className={canEditRow && isActiveRow ? 'text-blue-700 font-bold' : hasEntry ? 'text-slate-800' : 'text-slate-400'}>
                            {formatDisplayDate(dateStr)}
                          </span>
                        </div>
                      </td>
                      <td 
                        className={`px-2 py-1 align-middle border-r border-slate-100/50 ${canEditRow && isActiveRow ? 'bg-blue-50' : canEditRow ? 'bg-[#fffbeb] group-hover:bg-[#fef3c7] group-focus-within:bg-blue-100' : hasEntry ? 'bg-white' : 'bg-slate-50/30'}`}
                        style={canEditRow && isActiveRow ? { boxShadow: 'inset 0 2px 0 0 #60a5fa, inset 0 -2px 0 0 #60a5fa' } : {}}
                      >
                        <span className={`block w-full min-w-[110px] truncate text-xs px-1 font-medium ${hasEntry ? 'text-slate-700' : 'text-slate-400 italic'}`} title={report?.shiftName || ''}>
                          {hasEntry ? (report?.shiftName || '—') : ''}
                        </span>
                      </td>
                      {INPATIENT_FIELDS.map((f, fIdx) => {
                        const value = hasEntry ? (entry[f.key] ?? 0) : 0;
                        const canEditCell = canEditRow && f.editable;

                        return (
                          <td 
                            key={f.key} 
                            className={`px-1 py-1 text-center align-middle ${f.computed ? (canEditRow && isActiveRow ? 'bg-blue-100/50 font-bold text-blue-800' : 'bg-black/[0.02] font-semibold text-slate-700') : ''}`}
                            style={canEditRow && isActiveRow ? { boxShadow: fIdx === INPATIENT_FIELDS.length - 1 ? 'inset -2px 0 0 0 #60a5fa, inset 0 2px 0 0 #60a5fa, inset 0 -2px 0 0 #60a5fa' : 'inset 0 2px 0 0 #60a5fa, inset 0 -2px 0 0 #60a5fa' } : {}}
                          >
                            {canEditCell ? (
                              <input
                                ref={fIdx === 1 && isActiveRow ? firstInputRef : undefined}
                                type="number"
                                min="0"
                                placeholder="0"
                                className="w-16 h-9 px-1 text-center bg-white border border-blue-300 rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all tabular-nums text-slate-900 font-medium mx-auto block"
                                value={hasEntry ? (entry[f.key] ?? '') : ''}
                                onChange={(e) => onDiseaseChange(dateStr, singleSelectedDisease, f.key, e.target.value)}
                                onBlur={() => onAutoSave(dateStr)}
                                onKeyDown={onKeyDown}
                                onFocus={(e) => e.target.select()}
                              />
                            ) : (
                              <span className={`block mx-auto min-w-[2rem] ${!hasEntry ? 'text-slate-300 italic' : isMultiSelect ? 'text-slate-700 font-medium' : canEditRow ? 'text-blue-700' : 'text-slate-600'}`}>
                                {hasEntry ? value : '—'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-20 bg-teal-100 shadow-[0_-1px_2px_-1px_rgba(0,0,0,0.1)] border-t-2 border-teal-200">
                <tr className="font-bold text-teal-900">
                  <td colSpan="2" className="px-3 py-4 text-right uppercase text-[13px] border-r border-teal-200 sticky left-0 z-10 bg-teal-100 shadow-[1px_0_0_0_#99f6e4]">
                    Tổng cộng (Tháng):
                  </td>
                  <td className="px-3 py-4 border-r border-teal-200 bg-teal-100"></td>
                  {INPATIENT_FIELDS.map((field) => (
                    <td key={'total_' + field.key} className="px-2 py-4 text-center border-r border-teal-200 text-teal-700 text-base">
                      {totals[field.key]}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, highlight }) {
  const colors = {
    indigo: 'bg-indigo-100 border-indigo-400 text-indigo-700',
    sky: 'bg-sky-100 border-sky-400 text-sky-700',
    orange: 'bg-orange-100 border-orange-400 text-orange-700',
    emerald: 'bg-emerald-100 border-emerald-400 text-emerald-700',
  };

  return (
    <div className={`rounded-lg border-2 px-3 py-3 ${colors[color]} ${highlight ? 'ring-2 ring-emerald-400 shadow-sm' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-emerald-800' : ''}`}>{value}</div>
    </div>
  );
}

/** Normalize Vietnamese text for fuzzy matching */
function normalizeVN(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function fuzzyMatch(text, query) {
  if (!query) return true;
  const normalizedText = normalizeVN(text);
  const normalizedQuery = normalizeVN(query);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  return terms.every(t => normalizedText.includes(t));
}

function InlineDiseaseSearch({ availableGroupA, availableGroupB, availableToAdd, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const filteredA = useMemo(() => availableGroupA.filter(d => fuzzyMatch(d.name, search)), [availableGroupA, search]);
  const filteredB = useMemo(() => availableGroupB.filter(d => fuzzyMatch(d.name, search)), [availableGroupB, search]);
  const flatList = useMemo(() => [...filteredA, ...filteredB], [filteredA, filteredB]);
  const totalFiltered = flatList.length;

  // Reset highlight when search changes
  useEffect(() => { setHighlightIdx(-1); }, [search]);

  const handleSelect = (name) => {
    onSelect(name);
    setSearch('');
  };

  // Keyboard: Escape, ArrowDown, ArrowUp, Enter
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (totalFiltered === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx(prev => {
          const next = prev < totalFiltered - 1 ? prev + 1 : 0;
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx(prev => {
          const next = prev > 0 ? prev - 1 : totalFiltered - 1;
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const idx = highlightIdx >= 0 ? highlightIdx : 0;
        if (flatList[idx]) handleSelect(flatList[idx].name);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, totalFiltered, highlightIdx, flatList]);

  // Render a single disease row
  let globalIdx = -1;
  const renderItem = (d, defaultColor) => {
    globalIdx++;
    const idx = globalIdx;
    const isActive = idx === highlightIdx;
    return (
      <button
        key={d.id}
        ref={el => (itemRefs.current[idx] = el)}
        onClick={() => handleSelect(d.name)}
        onMouseEnter={() => setHighlightIdx(idx)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors border-b border-slate-50 last:border-0 ${isActive ? 'bg-teal-50 ring-1 ring-inset ring-teal-200' : 'hover:bg-slate-50'}`}
      >
        <span className="w-3.5 h-3.5 rounded-full shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: d.color || defaultColor }} />
        <span className={`font-medium ${isActive ? 'text-teal-800' : 'text-slate-700'}`}>{d.name}</span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {/* Modal card */}
      <div ref={panelRef} className="relative w-[400px] max-w-[90vw] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-700">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4" /> Thêm bệnh truyền nhiễm
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors rounded-full p-0.5 hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Gõ tên bệnh để lọc nhanh... (↑↓ chọn, Enter thêm)"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => { setSearch(''); inputRef.current?.focus(); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* List */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {filteredA.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-bold text-red-700 uppercase tracking-wider bg-red-50 border-b border-red-100 sticky top-0 z-10">
                🔴 Nhóm A — Đặc biệt nguy hiểm
              </div>
              {filteredA.map(d => renderItem(d, '#ef4444'))}
            </div>
          )}
          {filteredB.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 border-b border-blue-100 sticky top-0 z-10">
                🔵 Nhóm B — Nguy hiểm
              </div>
              {filteredB.map(d => renderItem(d, '#3b82f6'))}
            </div>
          )}
          {totalFiltered === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">
                {availableToAdd.length === 0 ? 'Tất cả bệnh đã được thêm ✓' : 'Không tìm thấy bệnh phù hợp'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
