import { format, subDays, parse, isAfter, isBefore, startOfDay, addHours, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

const DATE_FORMAT = 'yyyy-MM-dd';

export function formatDate(date) {
  return format(date, DATE_FORMAT);
}

export function formatDisplayDate(dateStr) {
  const d = parse(dateStr, DATE_FORMAT, new Date());
  return format(d, 'dd/MM/yyyy');
}

export function getToday() {
  return formatDate(new Date());
}

export function getYesterday() {
  return formatDate(subDays(new Date(), 1));
}

export function getDaysInMonthUpTo(dateStr) {
  const end = parse(dateStr, DATE_FORMAT, new Date());
  const start = startOfMonth(end);
  return eachDayOfInterval({ start, end }).map(d => format(d, DATE_FORMAT));
}

/**
 * Get ALL days in the month containing the given YYYY-MM string.
 */
export function getAllDaysInMonth(yearMonth) {
  const start = parse(`${yearMonth}-01`, DATE_FORMAT, new Date());
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end }).map(d => format(d, DATE_FORMAT));
}

/**
 * Move a date (YYYY-MM-DD) to a target month (YYYY-MM),
 * clamping the day if it doesn't exist (e.g. 31 → 28).
 */
export function clampDateToMonth(dateStr, targetYearMonth) {
  const day = parseInt(dateStr.substring(8, 10), 10);
  const target = parse(`${targetYearMonth}-01`, DATE_FORMAT, new Date());
  const lastDay = endOfMonth(target).getDate();
  const clampedDay = Math.min(day, lastDay);
  return `${targetYearMonth}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Determine current report date based on auto-lock hour.
 * Before lock hour → yesterday's report is still "today's active".
 * After lock hour → today is the new report date.
 */
export function getCurrentReportDate(autoLockHour = 8) {
  const now = new Date();
  const lockTime = addHours(startOfDay(now), autoLockHour);

  if (isBefore(now, lockTime)) {
    return formatDate(subDays(now, 1));
  }
  return formatDate(now);
}

/**
 * Check if a date should be auto-locked
 */
export function shouldAutoLock(reportDateStr, autoLockHour = 8) {
  const now = new Date();
  const reportDate = parse(reportDateStr, DATE_FORMAT, new Date());
  const lockDeadline = addHours(startOfDay(subDays(now, 0)), autoLockHour);

  // Lock if report date is before today and we're past the lock hour
  const today = startOfDay(now);
  return isBefore(reportDate, today) && isAfter(now, lockDeadline);
}

/**
 * Generate document ID for daily report: YYYY-MM-DD_deptId
 */
export function getReportDocId(dateStr, departmentId) {
  return `${dateStr}_${departmentId}`;
}

/**
 * Parse report doc ID back to date and department
 */
export function parseReportDocId(docId) {
  const parts = docId.split('_');
  const date = parts[0];
  const departmentId = parts.slice(1).join('_');
  return { date, departmentId };
}
