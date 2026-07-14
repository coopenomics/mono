import emailRegex from 'email-regex';
import type { IIndividualData } from 'src/shared/lib/types/user/IUserData';

const emailValidator = emailRegex({ exact: true });

/** Член совета в мастере установки (store + API install). */
export interface SovietInstallMember {
  role?: 'chairman' | 'member';
  individual_data?: IIndividualData & { email?: string };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPhoneFilled(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed !== '+7 (___) ___-__-__';
}

/** Все обязательные поля IndividualDataForm + email (как на экране «Состав совета»). */
export function isSovietMemberComplete(member: SovietInstallMember | null | undefined): boolean {
  const data = member?.individual_data;
  if (!data) return false;

  if (!isNonEmptyString(data.email) || emailValidator.test(data.email.trim()) !== true) {
    return false;
  }
  if (!isNonEmptyString(data.last_name) || !isNonEmptyString(data.first_name)) {
    return false;
  }
  if (!isNonEmptyString(data.full_address) || !isNonEmptyString(data.birthdate)) {
    return false;
  }
  if (!isPhoneFilled(data.phone)) {
    return false;
  }

  return true;
}

export function countCompleteSovietMembers(members: SovietInstallMember[]): number {
  return members.filter(isSovietMemberComplete).length;
}

export function getFirstIncompleteSovietMemberIndex(members: SovietInstallMember[]): number {
  return members.findIndex((member) => !isSovietMemberComplete(member));
}
