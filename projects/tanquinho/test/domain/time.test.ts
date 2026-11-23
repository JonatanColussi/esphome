import {
  clockTimeAfter,
  formatDuration,
  normalizeMinutes,
  parseHms,
  progressPercent,
} from '../../src/domain/time';

describe('formatDuration', () => {
  it('shows minutes below one hour and h + minutes above', () => {
    expect(formatDuration(28 * 60)).toBe('28 min');
    expect(formatDuration(72 * 60)).toBe('1h12');
    expect(formatDuration(60 * 60)).toBe('1h00');
    expect(formatDuration(3599)).toBe('1h00');
    expect(formatDuration(20)).toBe('1 min');
  });
});

describe('parseHms', () => {
  it('converts H:MM:SS to seconds and anything else to 0', () => {
    expect(parseHms('1:02:03')).toBe(3723);
    expect(parseHms('00:00:00')).toBe(0);
    expect(parseHms('')).toBe(0);
    expect(parseHms('abc')).toBe(0);
  });
});

describe('progressPercent', () => {
  it('returns elapsed share clamped to 0..100', () => {
    expect(progressPercent(600, 1200)).toBe(50);
    expect(progressPercent(0, 1200)).toBe(100);
    expect(progressPercent(1500, 1200)).toBe(0);
    expect(progressPercent(10, 0)).toBe(0);
  });
});

describe('clockTimeAfter', () => {
  const threePm = new Date(2026, 10, 3, 15, 0, 0).getTime();

  it('adds the duration and formats HH:MM in local time', () => {
    expect(clockTimeAfter(threePm, 40 * 60)).toBe('15:40');
    expect(clockTimeAfter(threePm, 65 * 60)).toBe('16:05');
    expect(clockTimeAfter(new Date(2026, 10, 3, 23, 50, 0).getTime(), 20 * 60)).toBe('00:10');
  });

  it('rounds to the nearest minute', () => {
    expect(clockTimeAfter(threePm, 29)).toBe('15:00');
    expect(clockTimeAfter(threePm, 30)).toBe('15:01');
  });
});

describe('normalizeMinutes', () => {
  it('accepts comma decimals, rounds to 0.5 and clamps to 0.5..max', () => {
    expect(normalizeMinutes('2,5', 10)).toBe(2.5);
    expect(normalizeMinutes('3.3', 30)).toBe(3.5);
    expect(normalizeMinutes('12', 10)).toBe(10);
    expect(normalizeMinutes('0.2', 30)).toBe(0.5);
  });

  it('rejects text that is not a number', () => {
    expect(normalizeMinutes('abc', 10)).toBeNull();
  });
});
