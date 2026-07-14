import { env } from 'src/shared/config';
import {
  countCompleteSovietMembers,
  getFirstIncompleteSovietMemberIndex,
  type SovietInstallMember,
} from './sovietMemberValidation';

/** Как MIN_SOVIET_MEMBERS_COUNT в контракте soviet: 1 на dev/testnet, 3 на production. */
export function getMinSovietMembersCount(): number {
  return env.NODE_ENV === 'production' ? 3 : 1;
}

function councilRoleLabel(index: number, role?: SovietInstallMember['role']): string {
  if (role === 'chairman' || index === 0) return 'председателя совета';
  return `члена совета №${index + 1}`;
}

/** Краткая подсказка под формой: сколько указано и чего не хватает. */
export function getSovietMembersProgressHint(
  members: SovietInstallMember[],
  min = getMinSovietMembersCount(),
): string | null {
  const completeCount = countCompleteSovietMembers(members);
  if (completeCount < min) {
    const missing = min - completeCount;
    return `Заполнены данные ${completeCount} из ${min}. Дозаполните ещё ${missing} ${pluralCouncilSlot(missing)}.`;
  }

  const incompleteIndex = getFirstIncompleteSovietMemberIndex(members);
  if (incompleteIndex >= 0) {
    return `Заполните все поля для ${councilRoleLabel(incompleteIndex, members[incompleteIndex]?.role)}.`;
  }

  return null;
}

/** Текст для tooltip заблокированной кнопки «Продолжить». */
export function getSovietContinueBlockedTooltip(
  members: SovietInstallMember[],
  min = getMinSovietMembersCount(),
): string {
  const completeCount = countCompleteSovietMembers(members);
  if (completeCount < min) {
    const missing = min - completeCount;
    if (min === 1) return 'Заполните все данные председателя совета';
    return `Для продолжения нужно ${min} человека с полными данными (ещё ${missing} ${pluralCouncilSlot(missing)})`;
  }

  const incompleteIndex = getFirstIncompleteSovietMemberIndex(members);
  if (incompleteIndex >= 0) {
    return `Заполните все поля для ${councilRoleLabel(incompleteIndex, members[incompleteIndex]?.role)}`;
  }

  return '';
}

function pluralCouncilSlot(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'человек';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'человека';
  return 'человек';
}
