import { env } from 'src/shared/config';

/** Как MIN_SOVIET_MEMBERS_COUNT в контракте soviet: 1 на dev/testnet, 3 на production. */
export function getMinSovietMembersCount(): number {
  return env.NODE_ENV === 'production' ? 3 : 1;
}

/** Краткая подсказка под формой: сколько указано и чего не хватает. */
export function getSovietMembersProgressHint(currentCount: number, min = getMinSovietMembersCount()): string | null {
  if (min <= 1 || currentCount >= min) return null;
  const missing = min - currentCount;
  return `Указано ${currentCount} из ${min}. Добавьте ещё ${missing} ${pluralCouncilSlot(missing)}.`;
}

/** Текст для tooltip заблокированной кнопки «Продолжить». */
export function getSovietContinueBlockedTooltip(currentCount: number, min = getMinSovietMembersCount()): string {
  if (currentCount >= min) return '';
  if (min === 1) return 'Заполните данные председателя';
  const missing = min - currentCount;
  return `Для продолжения нужно ${min} человека в составе совета (ещё ${missing} ${pluralCouncilSlot(missing)})`;
}

function pluralCouncilSlot(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'человек';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'человека';
  return 'человек';
}
