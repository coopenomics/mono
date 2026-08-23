import type { ProgramKey } from './registration.port';

/**
 * Пайщик принят в кооператив.
 *
 * Ядро сообщает об этом всем расширениям сразу после приёма: каждое решает
 * само, нужно ли ему что-то завести под нового пайщика. Хэши подписанных оферт
 * приходят вместе с событием — расширению не нужно ходить за ними отдельно.
 */
export const PARTICIPANT_REGISTERED_EVENT = 'participant.registered' as const;

export interface InnerParticipantRegisteredEvent {
  username: string;
  /** Программа, выбранная при вступлении; может отсутствовать. */
  program_key?: ProgramKey;
  /** Кооперативный участок, если пайщик вступил через него. */
  braname?: string;
  account_type: string;
  blagorost_offer_hash?: string;
  generator_offer_hash?: string;
}
