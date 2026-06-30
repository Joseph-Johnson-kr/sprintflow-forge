const WEEKDAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** 1 = Monday … 5 = Friday */
export const SPRINT_START_OPTIONS = WEEKDAY_FULL.map((label, i) => ({
  value: i + 1,
  label,
}));

/**
 * Maps a 1-indexed sprint day to a three-letter weekday abbreviation,
 * cycling Mon→Fri and skipping weekends.
 *
 * sprintStartDay: 1 = Monday … 5 = Friday
 */
export function sprintDayLabel(sprintDay: number, sprintStartDay: number): string {
  const startIdx = sprintStartDay - 1; // 0 = Mon
  const idx = (startIdx + (sprintDay - 1)) % 5;
  return WEEKDAY_ABBR[idx];
}

/**
 * Returns all column labels for a sprint (1-indexed days 1..length).
 */
export function buildDayLabels(sprintLength: number, sprintStartDay: number): string[] {
  return Array.from({ length: sprintLength }, (_, i) =>
    sprintDayLabel(i + 1, sprintStartDay),
  );
}
