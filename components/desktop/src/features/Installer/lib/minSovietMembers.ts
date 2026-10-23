import { env } from 'src/shared/config';
import { t } from 'src/shared/i18n';

/** Как MIN_SOVIET_MEMBERS_COUNT в контракте soviet: 1 на dev/testnet, 3 на production. */
export function getMinSovietMembersCount(): number {
  return env.NODE_ENV === 'production' ? 3 : 1;
}

/** Краткая подсказка под формой: сколько указано и чего не хватает. */
export function getSovietMembersProgressHint(currentCount: number, min = getMinSovietMembersCount()): string | null {
  if (min <= 1 || currentCount >= min) return null;
  const missing = min - currentCount;
  return t('installer.soviet.progressHint', { current: currentCount, min, missing }, missing);
}

/** Текст для tooltip заблокированной кнопки «Продолжить». */
export function getSovietContinueBlockedTooltip(currentCount: number, min = getMinSovietMembersCount()): string {
  if (currentCount >= min) return '';
  if (min === 1) return t('installer.soviet.fillChairman');
  const missing = min - currentCount;
  return t('installer.soviet.continueBlocked', { min, missing }, missing);
}
