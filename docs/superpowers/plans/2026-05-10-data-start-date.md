# Data Start Date & Export/Import Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add configurable data start date with auto-backup, Excel export from SummaryPage, and improved multi-section/multi-sheet import.

**Architecture:** Client-side Firestore batch operations with chunking. New `excelUtils.js` for shared export/import logic. Settings-driven date restriction across DataEntryPage.

**Tech Stack:** React, Firebase Firestore, SheetJS (xlsx), date-fns

**Spec:** `docs/superpowers/specs/2026-05-10-data-start-date-design.md`

---

## Task 1: Excel Utils — Sheet Name & Export/Import Helpers

**Files:**
- Create: `src/utils/excelUtils.js`

- [ ] **Step 1: Create excelUtils.js with sheet name helpers**

```js
// Sheet name sanitize (Excel max 31 chars, no special chars)
export function toSheetName(deptId, deptName) {
  const prefix = `[${deptId}] `;
  const maxNameLen = 31 - prefix.length;
  const sanitized = deptName
    .replace(/[\\\/\?\*\[\]:]/g, '')
    .substring(0, maxNameLen);
  return prefix + sanitized;
}

export function parseDeptIdFromSheet(sheetName) {
  const match = sheetName.match(/^\[([^\]]+)\]/);
  return match ? match[1] : null;
}
```

- [ ] **Step 2: Add export function**

Build `exportReportsToExcel(reports, departments, settings, fileName)`:
- Groups reports by department
- Creates sheet per dept with 3 sections: KCB, BTN, Tử vong
- Date format: yyyyMMdd
- KCB columns: Ngày | Tua trực | BN cũ | Vào viện | Chuyển đến | Chuyển đi | Ra viện | Tử vong | Chuyển viện | BN hiện tại
- BTN section after 2 empty rows with "BỆNH TRUYỀN NHIỄM" header
- Death section after 2 empty rows with "DANH SÁCH TỬ VONG" header
- Uses `xlsx.writeFile()` to download

- [ ] **Step 3: Add import parser function**

Build `parseImportSheet(sheetData)`:
- Detects 3 sections by header markers
- KCB: imports only movement fields (skips BN cũ, BN hiện tại)
- BTN: imports Tên bệnh + movement fields (skips BN cũ, BN hiện tại)
- Death: imports all columns
- Date parsing: yyyyMMdd format
- Returns `{ kcbRecords, btnRecords, deathRecords }`

- [ ] **Step 4: Verify build**

Run: `npm run dev` — no errors

- [ ] **Step 5: Commit**

```bash
git add src/utils/excelUtils.js
git commit -m "feat: add excelUtils with sheet name helpers, export, and import parser"
```

---

## Task 2: Report Service — Purge & Backfill Functions

**Files:**
- Modify: `src/services/reportService.js`

- [ ] **Step 1: Add deleteReportsBeforeDate**

```js
export async function deleteReportsBeforeDate(dateStr) {
  // Query dailyReports where date < dateStr
  // Batch delete in chunks of 499
  // Return count deleted
}
```

- [ ] **Step 2: Add deleteAuditLogsBeforeDate**

```js
export async function deleteAuditLogsBeforeDate(dateStr) {
  // Query auditLogs where date < dateStr (or timestamp < dateStr)
  // Batch delete in chunks of 499
  // Return count deleted
}
```

- [ ] **Step 3: Add backfillReportsForExpansion**

```js
export async function backfillReportsForExpansion(newStartDate, oldStartDate, departments) {
  // For each dept: read bnCu of oldStartDate
  // Create docs for each day from newStartDate to oldStartDate-1
  // All movement fields = 0, bnCu = bnHienTai = value from old start
  // Same for infectiousData
  // Batch write in chunks of 499
}
```

- [ ] **Step 4: Add getStartDateBnCuByDept**

```js
export async function getStartDateBnCuByDept(dateStr, departments) {
  // For each dept, read the report on dateStr
  // Return Map<deptId, { bnCu, infectiousData }>
}
```

- [ ] **Step 5: Verify build**

Run: `npm run dev` — no errors

- [ ] **Step 6: Commit**

```bash
git add src/services/reportService.js
git commit -m "feat: add purge and backfill functions to reportService"
```

---

## Task 3: Constants & Settings — dataStartDate

**Files:**
- Modify: `src/utils/constants.js`

- [ ] **Step 1: Add dataStartDate to DEFAULT_SETTINGS**

```js
export const DEFAULT_SETTINGS = {
  hospitalName: '',
  autoLockEnabled: true,
  autoLockHour: 8,
  requireApproval: false,
  activeCategories: ['inpatient'],
  dataStartDate: null,  // YYYY-MM-DD or null (no restriction)
};
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/constants.js
git commit -m "feat: add dataStartDate to DEFAULT_SETTINGS"
```

---

## Task 4: SettingsPage — Data Start Date UI

**Files:**
- Modify: `src/pages/SettingsPage.jsx`

- [ ] **Step 1: Add state variables**

Add state for: `dataStartMonth`, `dataStartYear`, `showStartDateDialog`, `startDateProgress`, `startDateProcessing`

- [ ] **Step 2: Add UI section in general tab**

After the Import Excel section (inside `user.role === ROLES.ADMIN` block):
- Card with title "Tháng bắt đầu nhập liệu"
- Current status display
- Two selects: Month (1-12) + Year (2024-2030)
- "Cập nhật" button

- [ ] **Step 3: Add confirmation dialog**

Dialog with:
- FORWARD: Red warning, "XOA" text confirmation
- BACKWARD: Yellow warning about BN cũ carry-forward
- FIRST TIME no data: Simple confirmation
- Progress steps display during execution

- [ ] **Step 4: Add handler function handleUpdateDataStartDate**

Flow:
1. Determine scenario (forward/backward/first)
2. Show confirmation dialog
3. On confirm: auto-export backup via `exportReportsToExcel`
4. Execute purge or backfill
5. Update `settings.dataStartDate`
6. Show success toast
7. Reload settings state

- [ ] **Step 5: Verify build and test UI**

Run: `npm run dev` → navigate to Settings → verify UI renders correctly

- [ ] **Step 6: Commit**

```bash
git add src/pages/SettingsPage.jsx
git commit -m "feat: add data start date configuration UI with confirmation dialog"
```

---

## Task 5: DataEntryPage — Navigation & Editable BN cũ

**Files:**
- Modify: `src/pages/DataEntryPage.jsx`

- [ ] **Step 1: Load dataStartDate from settings**

In `initApp()`, read `settings.dataStartDate` and store in state.

- [ ] **Step 2: Restrict navigation**

- `handlePrevMonth`: disable when at dataStartDate month
- `handleSelectDate`: disable dates before dataStartDate in Calendar
- Filter `daysInMonth` to only include `>= dataStartDate`

- [ ] **Step 3: Make BN cũ editable on start date**

In the KCB table render:
- Condition: `dateStr === settings.dataStartDate && editable`
- Render number input for `bnCu` field instead of readonly span
- Distinct style: blue border (`ring-2 ring-blue-400`)
- On change: call `handleFieldChange(dateStr, 'bnCu', value)` with cascade
- On blur: auto-save

- [ ] **Step 4: Handle bnCu field change with cascade**

Update `handleFieldChange` to handle `bnCu` changes:
- Recompute `bnHienTai` for the changed day
- Cascade to all subsequent days (existing cascade logic)

- [ ] **Step 5: Same for infectious disease BN cũ on start date**

In the BTN tab: make infectious `bnCu` editable on `dataStartDate`.

- [ ] **Step 6: Restrict initializeDepartmentReportsForMonth**

In `reportService.js`: skip creating docs for days before `dataStartDate`.

- [ ] **Step 7: Verify build and test**

Run: `npm run dev` → test navigation restriction, editable BN cũ, cascade

- [ ] **Step 8: Commit**

```bash
git add src/pages/DataEntryPage.jsx src/services/reportService.js
git commit -m "feat: restrict data entry to dataStartDate, editable BN cũ on start date"
```

---

## Task 6: SummaryPage — Export Button

**Files:**
- Modify: `src/pages/SummaryPage.jsx`

- [ ] **Step 1: Add export button to filter bar**

Next to preset buttons, add "Export Excel" button with download icon.

- [ ] **Step 2: Add export handler**

```js
async function handleExport() {
  const fileName = `BaoCao_${startDate}_${endDate}.xlsx`;
  exportReportsToExcel(rawReports, departments, settings, fileName);
}
```

- [ ] **Step 3: Verify and test**

Run: `npm run dev` → test export from Summary page

- [ ] **Step 4: Commit**

```bash
git add src/pages/SummaryPage.jsx
git commit -m "feat: add Excel export to SummaryPage"
```

---

## Task 7: ImportDataModal — Multi-sheet & Multi-section

**Files:**
- Modify: `src/components/data-entry/ImportDataModal.jsx`

- [ ] **Step 1: Detect single vs multi-sheet**

On file upload: check sheet count.
- Single sheet → existing flow (user picks dept)
- Multi-sheet → auto-map via `parseDeptIdFromSheet`

- [ ] **Step 2: Multi-sheet preview UI**

Show table: Sheet name → Mapped department → Status (matched/unmatched)
Warning for unmatched sheets.

- [ ] **Step 3: Multi-section parsing**

Use `parseImportSheet` from excelUtils to parse KCB + BTN + Death sections per sheet.

- [ ] **Step 4: Import all matched sheets**

For each matched sheet: import KCB records (existing logic), BTN records, death records.

- [ ] **Step 5: Update date format handling**

Parse yyyyMMdd format for dates. Support both old format and new format for backward compatibility.

- [ ] **Step 6: Verify and test round-trip**

Export from SummaryPage → Import the same file → verify data matches.

- [ ] **Step 7: Commit**

```bash
git add src/components/data-entry/ImportDataModal.jsx
git commit -m "feat: multi-sheet auto-mapping and multi-section import"
```

---

## Task 8: Integration Testing & Polish

- [ ] **Step 1: Test full flow — set dataStartDate for first time**
- [ ] **Step 2: Test forward scenario (purge)**
- [ ] **Step 3: Test backward scenario (expand)**
- [ ] **Step 4: Test export → import round-trip**
- [ ] **Step 5: Test navigation restriction on DataEntryPage**
- [ ] **Step 6: Test editable BN cũ on start date with cascade**
- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: data start date, export/import improvements - complete"
```
