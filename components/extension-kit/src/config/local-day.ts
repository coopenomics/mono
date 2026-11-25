/**
 * Календарный день по часовому поясу кооператива. Сроки, которые человек
 * понимает «до конца дня» (код передачи на пункте выдачи), считаются здесь:
 * полночь — местная, а не UTC.
 */

/** Смещение часового пояса от UTC в момент, миллисекунд (Москва — +3 ч). */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Полночь, которой кончается текущий день момента в часовом поясе кооператива. */
export function nextLocalMidnight(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const utcMidnight = Date.UTC(get('year'), get('month') - 1, get('day') + 1);
  return new Date(utcMidnight - timeZoneOffsetMs(new Date(utcMidnight), timeZone));
}
