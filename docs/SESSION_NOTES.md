# Session Notes

## Session 2026-04-17 — Dashboard TV Mode & Excel Import Enhancements

### What was done

1. **Excel Import — Multi-sheet support** (`ImportDataModal.jsx`)
   - Refactored to detect valid sheets (column header matching)
   - Added sheet selection dropdown + department picker
   - Continuous import workflow: after each successful import, returns to selection screen
   - BN cũ logic: auto-fetched from previous day's Firestore data, user can override

2. **Trend Chart Time Ranges** (`DashboardPage.jsx`)
   - Added `TREND_RANGES` constant: 1 tuần (7d), 2 tuần (14d), 1 tháng (30d), 1 tháng (90d)
   - Dynamic Firestore query based on selected range
   - Adaptive chart: dot visibility + x-axis tick interval adjusts by range

3. **TV Mode — 2-page Scroll-Snap Layout** (`DashboardPage.jsx`)
   - `scroll-snap-type: y mandatory` on content wrapper
   - Page 1 (`snap-start h-full`): KPI cards + trend chart
   - Page 2 (`snap-start h-full`): Full-viewport table only
   - Trend chart auto-collapses via `useEffect` when TV mode activates (`setTrendOpen(!isTvMode)`)
   - Table → `w-auto`, fixed-width columns (not full-width stretch)

4. **Visual Hierarchy Improvements** (`DashboardPage.jsx`)
   - Zero values → muted gray `text-slate-400`
   - Tử vong > 0 → `text-red-600 font-bold bg-red-50`
   - Facility subtotals (Tổng Cơ sở 1 / Tổng Cơ sở 2) → soft orange theme
   - Header margin compact in TV mode

### Decisions made
- **Scroll-snap approach**: Chose CSS scroll-snap over JS-based scrollTo() for smoother, native behavior
- **Single JSX path**: Instead of duplicating JSX for TV/normal, used conditional `className` + inline `style` on shared wrapper divs
- **`w-auto` table**: Prevents columns from stretching to fill screen width in TV mode; columns use fixed `w-[Xpx]` values
- **`useEffect([isTvMode])`**: Auto-collapse trend ensures table snap page occupies maximum height

### Pending items
- [ ] Verify normal mode layout still renders correctly with new Section 1/2 div wrappers
- [ ] Consider scroll indicator dots for TV snap pages
- [ ] Real-time Firestore listeners for DashboardPage (currently one-shot fetch)
- [ ] TV mode font-size scaling if departments grow

### Key files modified
- `src/pages/DashboardPage.jsx` — Major: TV snap layout, trend ranges, visual hierarchy
- `src/components/data-entry/ImportDataModal.jsx` — Major: multi-sheet detection, continuous import flow

---

## Session 2026-03-29 — Command Center Redesign

### What was done
- Dashboard command center redesign with KPI cards
- Real-time Firestore listeners added
- BTN (Bệnh truyền nhiễm) card with side-by-side compact layout
- Death list improvements
- Collapsible trend charts
- Toggleable Tua trực column

### Key files modified
- `src/pages/DashboardPage.jsx`
- `src/components/summary/DeathListPanel.jsx`
