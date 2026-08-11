import type { IMonoAccount } from './mono-account.contract';
import type { InnerPage, InnerPageRequest } from './payment.port';

/**
 * Заявки на вступление в кооператив.
 *
 * Расширение показывает их со своей добавкой — например, кто из кандидатов уже
 * заявлен участником программы. Сами заявки ведёт ядро: приём в кооператив это
 * решение совета, а не действие расширения.
 *
 * Право видеть заявки проверяет ядро по учётной записи спрашивающего — она
 * передаётся первым аргументом.
 */

/**
 * Заявка на вступление.
 *
 * Поля перечислены полностью, без индексной сигнатуры: расширение расширяет
 * заявку своими полями через копирование, а с индексной сигнатурой копия
 * теряет обязательность известных полей, и подстановка в форму ответа
 * перестаёт проверяться.
 */
export interface InnerCandidate {
  username: string;
  coopname: string;
  status: string;
  /** Вид субъекта: физлицо, организация, предприниматель. */
  type: string;
  created_at: Date;
  /** Открытый ключ кандидата: по нему он подписывает документы вступления. */
  public_key: string;
  /** Человеческое имя для показа. */
  username_display_name?: string;
  braname?: string;
  registered_at?: Date;
  referer?: string;
  referer_display_name?: string;
  program_key?: string;
}

export interface InnerCandidateFilter {
  /** Кто пригласил кандидата. */
  referer?: string;
  [key: string]: any;
}

/** Подписанный кандидатом документ вступления. */
export interface InnerCandidateDocument {
  doc_hash: string;
  [key: string]: any;
}

export interface ICandidatePort {
  /**
   * Заявка по учётному имени; `null`, если её нет.
   *
   * Отдаёт и подписанные при вступлении документы: расширению нужен хэш своей
   * оферты, чтобы связать участие с подписью, а искать её отдельно негде.
   */
  findByUsername(username: string): Promise<(InnerCandidate & { documents?: Record<string, InnerCandidateDocument> }) | null>;

  getCandidates(
    currentUser: IMonoAccount,
    filter?: InnerCandidateFilter,
    page?: InnerPageRequest
  ): Promise<InnerPage<InnerCandidate>>;
}

export const CANDIDATE_PORT = Symbol.for('Innercoop.CorePort.Candidate');
