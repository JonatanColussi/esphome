const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;

export const MIN_MINUTES = 0.5;

const pad = (value: number) => String(value).padStart(2, '0');

/** Local "HH:MM" after `seconds`, rounded to the nearest minute. */
export function clockTimeAfter(nowMs: number, seconds: number): string {
  const date = new Date(nowMs + Math.round(seconds / SECONDS_PER_MINUTE) * MS_PER_MINUTE);

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "28 min" below one hour, "1h12" from one hour on; never less than 1 min. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  return hours === 0 ? `${minutes} min` : `${hours}h${pad(minutes)}`;
}

/** Minutes typed in a settings field: comma or dot, steps of 0.5, between 0.5 and `max`. */
export function normalizeMinutes(raw: string, max: number): number | null {
  const value = Number.parseFloat(raw.replace(',', '.'));

  if (Number.isNaN(value)) {
    return null;
  }

  return Math.min(max, Math.max(MIN_MINUTES, Math.round(value * 2) / 2));
}

/** Seconds in an "H:MM:SS" text published by the firmware; 0 when it is not one. */
export function parseHms(text: string): number {
  const parts = text.split(':');

  if (parts.length !== 3) {
    return 0;
  }

  const [hours, minutes, seconds] = parts.map(part => Number.parseInt(part, 10));
  const total = hours * 3600 + minutes * SECONDS_PER_MINUTE + seconds;

  return Number.isNaN(total) ? 0 : total;
}

export function progressPercent(remainingSeconds: number, totalSeconds: number): number {
  if (totalSeconds === 0) {
    return 0;
  }

  const percent = Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100);

  return Math.max(0, Math.min(100, percent));
}
