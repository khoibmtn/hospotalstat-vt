# Data Start Date & Export/Import Improvements — Design Spec

> Approved: 2026-05-10

## Overview

Simplify initial data entry by letting Admin set a "data start date" (month/year). All data before this date is purged (with auto-backup). The first day of the start month gets an editable "BN cũ" field. Additionally, add full Excel export from SummaryPage and improve import to support multi-section, multi-sheet round-trip.

---

## 1. Setting: "Tháng bắt đầu nhập liệu"

### Location
- `SettingsPage` → tab "Cấu hình chung" → after Import Excel section
- **Admin only** (`user.role === ROLES.ADMIN`)

### UI
- Label: "Tháng bắt đầu nhập liệu"
- Two dropdowns: Month (1-12) + Year (2024-2030)
- Current status display: "Đang thiết lập: Tháng 05/2026" or "Chưa thiết lập"
- "Cập nhật" button → opens confirmation dialog

### Data Model
```js
// Firestore: settings/config
{
  dataStartDate: "2026-05-01",  // YYYY-MM-DD, always 1st of month
  // ... existing settings
}
```

### Confirmation Dialog

**Scenario: FORWARD (e.g., 05/2026 → 07/2026) or FIRST TIME with existing data:**
- Red warning: "Toàn bộ dữ liệu trước tháng 07/2026 sẽ bị xóa vĩnh viễn."
- Text input confirmation: user must type "XOA" to proceed
- After confirm → auto export backup → execute purge

**Scenario: BACKWARD (e.g., 07/2026 → 05/2026):**
- Yellow warning: "Dữ liệu sẽ được mở rộng về tháng 05/2026. BN cũ ngày 01/05 = [current value]. Ô BN cũ editable sẽ chuyển từ 01/07 về 01/05."
- After confirm → auto export backup → execute expansion

**Scenario: FIRST TIME with no data:**
- Simple confirmation, save `dataStartDate`, BN cũ = 0

### Progress UI
Modal with steps: "Đang export backup... → Đang xóa dữ liệu cũ... → Đang tạo dữ liệu mới... → Hoàn tất ✓"

---

## 2. Processing Logic

### Common Flow
1. User selects month/year → clicks "Cập nhật" → confirmation dialog
2. User confirms → system auto-exports ALL current data as backup Excel (downloads to user's machine)
3. Execute scenario-specific logic (below)
4. Save `settings.dataStartDate`
5. Toast success

### FORWARD Scenario (purge)
1. Auto export backup
2. For each department: read `bnCu` of 1st day of NEW start month (value before deletion)
3. Delete all `dailyReports` with `date < newStartDate` (batch chunked, 499/batch)
4. Delete all `auditLogs` with `date < newStartDate` (batch chunked)
5. Docs on the new start date already exist and retain their `bnCu` — no changes needed
6. Save `dataStartDate`

### BACKWARD Scenario (expand)
1. Auto export backup
2. For each department: read `bnCu` of 1st day of CURRENT start month (e.g., `bnCu` of 1/7 = 25)
3. Create new docs for each department × each day from newStartDate to (oldStartDate - 1):
   - `bnCu = 25` (the value from step 2)
   - All movement fields = 0
   - `bnHienTai = 25`
   - `infectiousData`: carry forward with same pattern (bnCu = old infectious bnCu, movements = 0)
4. Update doc on old start date: no changes needed (bnCu already correct)
5. Save `dataStartDate`

### FIRST TIME with existing data
- Same as FORWARD: read bnCu of start date, delete before, save setting

### FIRST TIME without data
- Just save `dataStartDate`, bnCu = 0 for the start date

---

## 3. DataEntryPage Changes

### 3a. Navigation Restriction
- "Tháng trước" button: disabled when at the month of `dataStartDate`
- Calendar picker: disable all dates before `dataStartDate`
- If user is viewing a month before `dataStartDate` → snap to current month

### 3b. Editable BN cũ on Start Date
- Condition: `dateStr === settings.dataStartDate`
- BN cũ input becomes editable (number input, distinct blue border style)
- On change → cascade BN hiện tại for that day + all subsequent days (existing cascade logic in `handleFieldChange`)
- Auto-save on blur
- Respects lock/unlock: if the start date is locked, BN cũ remains readonly
- **Also applies to infectious disease BN cũ** on the start date

### 3c. Date Filtering
- `initializeDepartmentReportsForMonth`: skip days before `dataStartDate`
- `daysInMonth` array: filter to keep only days `>= dataStartDate`

### 3d. No Other Changes
- Tab BTN, Death tab: normal operation, but data restricted to `>= dataStartDate`
- Save, cascade, lock/unlock logic: unchanged

---

## 4. Export Feature (SummaryPage)

### Location
- "Export Excel" button on filter bar, next to preset buttons
- Uses current filters: `startDate`, `endDate`, `selectedDept`

### Excel Structure
- **Each department = 1 sheet**
- Sheet name: `[dept_id] SanitizedDeptName` (≤31 chars total)
- If `selectedDept = "all"` → all departments, each gets a sheet
- If specific dept → single sheet

### Sheet Content (per department)

**Section: KCB (starts at row 1)**
| Ngày (yyyymmdd) | Tua trực | BN cũ | Vào viện | Chuyển đến | Chuyển đi | Ra viện | Tử vong | Chuyển viện | BN hiện tại |
> Export includes BN cũ and BN hiện tại for user readability. Import SKIPS these computed columns.

**Section: BTN (after 2 empty rows)**
Header row: "BỆNH TRUYỀN NHIỄM"
| Ngày (yyyymmdd) | Tên bệnh | BN cũ | Vào viện | Chuyển đến | Chuyển đi | Ra viện | Tử vong | Chuyển viện | BN hiện tại |
> Export includes BN cũ and BN hiện tại. Import SKIPS these — they are recomputed from cascade logic.

**Section: Tử vong (after 2 empty rows)**
Header row: "DANH SÁCH TỬ VONG"
Columns from `settings.deathReportColumns` + Ngày (yyyymmdd) prepended

### File Naming
- Manual export: `BaoCao_[startDate]_[endDate].xlsx`
- Auto backup: `Backup_[yyyyMMdd_HHmmss].xlsx`

### Sheet Name Utils
```js
function toSheetName(deptId, deptName) {
  const prefix = `[${deptId}] `;
  const maxNameLen = 31 - prefix.length;
  const sanitized = deptName
    .replace(/[\\\/\?\*\[\]:]/g, '')  // remove Excel-invalid chars
    .substring(0, maxNameLen);
  return prefix + sanitized;
}

function parseDeptIdFromSheet(sheetName) {
  const match = sheetName.match(/^\[([^\]]+)\]/);
  return match ? match[1] : null;
}
```

---

## 5. Import Improvements (ImportDataModal)

### Multi-sheet File
1. Read all sheet names
2. For each sheet: parse `[dept_id]` from prefix using `parseDeptIdFromSheet`
3. Match dept_id against system departments
4. Show preview: which sheet maps to which department, warn if any sheet doesn't match
5. Import all matched sheets

### Single-sheet File
- Keep current behavior: user selects department from dropdown

### Multi-section Parsing (per sheet)
1. **KCB section**: starts at row 1, parse until empty row or section header
   - Columns: Ngày (yyyymmdd) | Tua trực | BN cũ | Vào viện | Chuyển đến | Chuyển đi | Ra viện | Tử vong | Chuyển viện | BN hiện tại
   - **Import only**: Tua trực, Vào viện, Chuyển đến, Chuyển đi, Ra viện, Tử vong, Chuyển viện
   - **Skip on import**: BN cũ (auto from previous day), BN hiện tại (computed)
2. **BTN section**: starts after "BỆNH TRUYỀN NHIỄM" header row
   - Parse infectious disease rows grouped by date
   - **Import only**: Tên bệnh + movement fields (Vào viện, Chuyển đến, etc.)
   - **Skip on import**: BN cũ, BN hiện tại (recomputed from cascade)
3. **Tử vong section**: starts after "DANH SÁCH TỬ VONG" header row
   - Parse death case rows using deathReportColumns config
   - Import all fields (no computed columns in death data)

### Date Format
- All dates use `yyyymmdd` format (e.g., `20260501`) — locale-independent
- Import parser: detect and parse this format

---

## 6. Files to Modify

### New Files
- `src/utils/excelUtils.js` — Sheet name sanitize, parse, export/import helpers

### Modified Files
- `src/utils/constants.js` — Add `dataStartDate` to `DEFAULT_SETTINGS`
- `src/services/settingsService.js` — No changes needed (generic get/update)
- `src/services/reportService.js` — Add `deleteReportsBeforeDate()`, `deleteAuditLogsBeforeDate()`, `backfillReports()`
- `src/pages/SettingsPage.jsx` — Add dataStartDate UI + confirmation dialog + progress modal
- `src/pages/DataEntryPage.jsx` — Navigation restriction, editable BN cũ on start date, date filtering
- `src/pages/SummaryPage.jsx` — Add Export button + export logic
- `src/components/data-entry/ImportDataModal.jsx` — Multi-sheet auto-mapping, multi-section parsing, yyyymmdd format

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| Admin changes start date while other users are entering data | Changes apply on next page load for other users. No real-time sync needed. |
| Start date set to future month | Block: only allow months ≤ current month |
| Start date = current month | Allowed. All historical data gets purged. |
| Department has no data on the old start date | BN cũ defaults to 0 for backward expansion |
| Firestore batch limit (500) | Chunk operations into 499-doc batches |
| Export with no data | Generate empty sheets with headers only |
| Import file with unknown dept_id in sheet name | Show warning, skip that sheet, continue others |
| Sheet name > 31 chars after prefix | Truncate department name portion |
