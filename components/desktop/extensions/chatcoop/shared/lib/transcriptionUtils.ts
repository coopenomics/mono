import { Zeus } from '@coopenomics/sdk'
import { uiLocale } from 'src/shared/i18n';

/** ISO-строка, timestamp (ms/s) или Date из ответа GraphQL / кэша Apollo */
function toTimeMs(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return toTimeMs((value as { value: unknown }).value);
  }
  return null;
}

export function formatDateTime(dateStr: unknown): string {
  const ms = toTimeMs(dateStr);
  if (ms == null) {
    return '';
  }
  const date = new Date(ms);
  return date.toLocaleDateString(uiLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(startStr: unknown, endStr: unknown): string {
  const startMs = toTimeMs(startStr);
  const endMs = toTimeMs(endStr);
  if (startMs == null || endMs == null) {
    return '';
  }
  const diffMs = endMs - startMs;
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  if (minutes > 0) {
    return `${minutes} мин ${seconds} сек`;
  }
  return `${seconds} сек`;
}

export function getStatusColor(status: unknown): string {
  const s = String(status);
  switch (s) {
    case Zeus.TranscriptionStatus.ACTIVE:
      return 'positive';
    case Zeus.TranscriptionStatus.COMPLETED:
      return 'primary';
    case Zeus.TranscriptionStatus.FAILED:
      return 'negative';
    default:
      return 'grey';
  }
}

export function getStatusLabel(status: unknown): string {
  const s = String(status);
  switch (s) {
    case Zeus.TranscriptionStatus.ACTIVE:
      return 'Активен';
    case Zeus.TranscriptionStatus.COMPLETED:
      return 'Завершён';
    case Zeus.TranscriptionStatus.FAILED:
      return 'Ошибка';
    default:
      return s;
  }
}

export function getStatusIcon(status: unknown): string {
  const s = String(status);
  switch (s) {
    case Zeus.TranscriptionStatus.ACTIVE:
      return 'fa-solid fa-circle-play';
    case Zeus.TranscriptionStatus.COMPLETED:
      return 'fa-solid fa-check';
    case Zeus.TranscriptionStatus.FAILED:
      return 'fa-solid fa-xmark';
    default:
      return 'fa-solid fa-phone';
  }
}

export function formatOffset(seconds: unknown): string {
  const secs = Number(seconds);
  if (isNaN(secs)) return '0:00';
  const mins = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${mins}:${s.toString().padStart(2, '0')}`;
}

export function getSpeakerInitials(name: unknown): string {
  const n = String(name || '');
  if (!n) return '?';
  const parts = n.split(/[\s_-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return n.slice(0, 2).toUpperCase();
}

/** Число участников с корректным склонением (1 участник, 2 участника, 5 участников). */
export function formatParticipantsCount(count: unknown): string {
  const n = Math.max(0, Math.floor(Number(count)));
  if (!Number.isFinite(n)) {
    return '0 участников';
  }
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word: string;
  if (mod10 === 1 && mod100 !== 11) {
    word = 'участник';
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    word = 'участника';
  } else {
    word = 'участников';
  }
  return `${n} ${word}`;
}
