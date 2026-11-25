import {
  InnerAccountType,
  PARTICIPANT_PROFILE_UPDATED_EVENT,
  type InnerParticipantProfileUpdatedEvent,
} from '@coopenomics/innercoop';
import type { EventsService } from '~/infrastructure/events/events.service';

/** Блоки личных данных: заполнен ровно один, по типу субъекта. */
interface ProfileData {
  individual_data?: { birthdate?: string } | null;
  entrepreneur_data?: { birthdate?: string } | null;
  organization_data?: unknown;
}

/**
 * Событие «личные данные пайщика записаны» из входных данных операции.
 *
 * Дата рождения берётся из входных данных, а не перечитывается: запись в склад
 * данных пайщиков идёт без ожидания, и перечитанная версия бывает прежней.
 * Возвращает `null`, если ни один блок не заполнен — событию нечего сообщить.
 */
export function buildParticipantProfileUpdatedEvent(
  username: string,
  data: ProfileData
): InnerParticipantProfileUpdatedEvent | null {
  if (data.individual_data) {
    return { username, account_type: InnerAccountType.individual, birthdate: data.individual_data.birthdate || null };
  }
  if (data.entrepreneur_data) {
    return { username, account_type: InnerAccountType.entrepreneur, birthdate: data.entrepreneur_data.birthdate || null };
  }
  if (data.organization_data) {
    return { username, account_type: InnerAccountType.organization, birthdate: null };
  }
  return null;
}

/** Опубликовать событие для расширений; без личных данных — ничего. */
export function emitParticipantProfileUpdated(events: EventsService, username: string, data: ProfileData): void {
  const event = buildParticipantProfileUpdatedEvent(username, data);
  if (event) events.emit(PARTICIPANT_PROFILE_UPDATED_EVENT, event);
}
