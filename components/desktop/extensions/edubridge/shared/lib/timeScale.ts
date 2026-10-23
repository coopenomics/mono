import { ref, type Ref } from 'vue';
import { fetchEconomySettings } from '../../entities/Economy';

/**
 * Сжатое время стенда разработки: сутки и месяцы образования укорочены, начало
 * занятий называется в минутах. В работе признак всегда выключен, и поля
 * «начало через N минут» в формах нет.
 */
const compressed = ref(false);
const daySeconds = ref(86400);
const monthSeconds = ref(0);
let asked: Promise<void> | null = null;

export function useTimeScale(): { compressed: Ref<boolean>; daySeconds: Ref<number>; monthSeconds: Ref<number> } {
  // Шкала у узла одна и за сеанс не меняется: спрашиваем один раз на всё приложение.
  asked ??= fetchEconomySettings()
    .then((s) => {
      compressed.value = Boolean(s.time_compressed);
      daySeconds.value = Number(s.day_seconds);
      monthSeconds.value = Number(s.month_seconds);
    })
    .catch(() => {
      asked = null;
    });
  return { compressed, daySeconds, monthSeconds };
}

/** Число минут из поля формы; пустое поле — начало называется датой. */
export function minutesOf(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
