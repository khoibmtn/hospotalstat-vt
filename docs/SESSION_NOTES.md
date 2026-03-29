# Session Notes

## Session 2026-03-29

### What was done
- **Dashboard Command Center Redesign (`DashboardPage.jsx`)**
  - Restructured KPI cards: BN hiện tại (+delta), BN mới, Tử vong (clickable), B. Truyền nhiễm (side-by-side with disease list)
  - BTN card: compact disease list with daily deltas (`Tên X (+n)` — red increase, green decrease)
  - Collapsible trend chart (click header to toggle)
  - Dropdown filter: Toàn viện / Cơ sở / Khoa for trend chart
  - Department table with facility grouping, bold subtotals, toggleable "Tua trực" column
  - Facility subtotal rows (Cơ sở 1, Cơ sở 2) + grand total row
- **Real-time Firestore Listeners**
  - Added `onReportsByDate()` and `onReportsByDateRange()` to `reportService.js` using `onSnapshot`
  - Replaced one-time `getDocs` in DashboardPage with 3 live listeners (today, yesterday, trend)
  - Dashboard auto-updates when any department submits data without page reload
  - Proper cleanup with unsubscribe callbacks on unmount/date change
- **DataEntryPage Improvements**
  - Death tab badge indicator, month navigation arrows, summary page month nav

### Decisions made
- **onSnapshot over polling**: Firestore real-time listeners chosen over interval polling — lower latency, no wasted reads, cleaner code
- **3 independent listeners** vs 1 big listener: Each data slice (today, yesterday, trend) has its own listener for targeted updates
- **BTN card side-by-side layout**: Disease list on the right prevents vertical expansion; total on the left for quick scan
- **Collapsible trend chart**: Saves vertical space during briefings when chart isn't needed

### Pending items
- `tuaTruc` field data entry flow (placeholder in table, data capture not yet in DataEntryPage)
- TV mode auto-scroll for large department tables

### Key files modified
- `src/pages/DashboardPage.jsx` — Full redesign: KPI cards, BTN card, trend chart, dept table, real-time listeners
- `src/services/reportService.js` — Added `onReportsByDate()`, `onReportsByDateRange()` with `onSnapshot`
- `src/pages/DataEntryPage.jsx` — Death tab integration, month nav improvements
- `src/pages/SettingsPage.jsx` — Death report column config improvements
- `src/pages/SummaryPage.jsx` — Month navigation
- `src/components/layout/AppShell.jsx` — Navigation updates
- `src/utils/dateUtils.js` — Date utility additions

## Session 2026-03-28/29

### What was done
- **Death Report Module (`DeathReportTab.jsx`)** — [NEW]
  - Accordion collapsible panel per day, shown when `tuVong > 0`
  - Modal form with dynamic columns from `settings.deathReportColumns`
  - Vertically-resizable text fields for clinical notes
  - Custom Dialog confirmation for delete (replaced `window.confirm`)
  - Validation: filled rows must match `tuVong` count
  - Visual states: ⚪ normal, 🔴 incomplete, 🟢 complete
  - Warning tooltip on incomplete death counts
- **Data Persistence Fix**: Added `deathCases` to Firestore payload in all 3 save paths (`handleAutoSaveRow`, `handleSaveRow`, `handleSaveAll`)
- **Settings — Death Report Column Config**
  - Added column management table: STT, Label, Type, Fixed/Custom toggle (🔒/🔓), Required toggle (✱)
  - 2-step inline delete confirm (✓/✕ instead of `window.confirm`)
  - Default fixed columns: only Mã KCB and Họ tên; others are customizable
- **InfectiousEntryTab.jsx** — [NEW] Extracted BTN entry from DataEntryPage
- **Disease Catalog enhancements**: MOH-standard names, reorder, search modal
- **Summary Page**: Disease filter chips, radio toggle, DiseaseBlock cards

### Decisions made
- **deathCases stored inside dailyReport document** — avoids sub-collection complexity, single Firestore read
- **isFixed vs isCore**: `isFixed` = cannot delete column, `isCore` = must fill data. Independent toggles.
- **2-step confirm pattern** over Dialog modal for settings delete — faster UX, no overlay

### Pending items
- Death List tab in Summary page (brainstormed, awaiting user answers on design options)

### Key files modified
- `src/components/data-entry/DeathReportTab.jsx` — [NEW] Death report entry
- `src/components/data-entry/InfectiousEntryTab.jsx` — [NEW] BTN entry tab
- `src/utils/validation.js` — [NEW] `isFilledRow()` for death case validation
- `src/pages/DataEntryPage.jsx` — Added deathCases persistence + death tab integration
- `src/pages/SettingsPage.jsx` — Column config table + toggles + 2-step delete
- `src/pages/SummaryPage.jsx` — BTN tab with disease filter chips
- `src/components/summary/InfectiousPanel.jsx` — Refactored with filter/radio/blocks
- `src/components/summary/DiseaseBlock.jsx` — [NEW] Per-disease card
- `src/services/diseaseCatalogService.js` — MOH name sync

## Session 2026-03-23 (Evening)

### What was done
- **Lock Management Page — 2-Column Redesign v3**: Full rewrite (~800 lines)
  - 2-column responsive grid: left sticky (controls), right scrollable (detail)
  - DeptTreeView: Toàn viện → Cơ sở → Khoa with tri-state cascade checkboxes
  - "Bỏ chọn tất cả" (Deselect All) button
  - Selection summary card with report counts
  - Safer CTA labels: "Khóa X báo cáo" / "Mở khóa Y báo cáo"
  - Detailed confirmation dialog
  - Skeleton loading + empty state
  - Expand/Collapse All toggle (fixed sync bug with useEffect)
  - Mobile: collapsible detail panel
  - Per-row lock/unlock buttons for individual reports
- **Moved summary+CTA card**: From bottom of left column to above detail panel (right column)
- **Vietnamese Calendar**: Replaced native `<input type="date">` with `react-day-picker` v9 + Popover
  - Created `calendar.jsx` — Calendar component with `locale={vi}`
  - Created `popover.jsx` — Radix Popover wrapper
  - Applied to both LockManagementPage and SummaryPage
  - Installed: `react-day-picker`, `@radix-ui/react-popover`, `react-is`

### Decisions made
- **react-day-picker v9** over v8: installed as latest, rewrote Calendar component for v9 API
- **Move CTAs above detail panel**: Better UX — user sees action buttons immediately instead of scrolling past treeview
- **No mode toggle**: Keep dual CTA buttons (Lock + Unlock) instead of stateful mode toggle

### Pending items
- None from this session

### Key files modified
- `src/pages/LockManagementPage.jsx` — Full redesign with 2-column layout + treeview
- `src/pages/SummaryPage.jsx` — Vietnamese calendar datepicker
- `src/components/ui/calendar.jsx` — [NEW] react-day-picker v9 + Vietnamese locale
- `src/components/ui/popover.jsx` — [NEW] Radix Popover wrapper
- `src/services/reportService.js` — Added `lockReport()` function
- `package.json` — Added react-day-picker, @radix-ui/react-popover, react-is
