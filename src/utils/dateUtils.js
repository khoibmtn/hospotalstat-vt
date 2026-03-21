import { format, subDays, parse, isAfter, isBefore, startOfDay, addHours, startOfMonth, eachDayOfInterval } from 'date-fns';

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
