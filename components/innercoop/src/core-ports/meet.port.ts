/**
 * Собрания пайщиков: перечислить и получить по идентификатору.
 *
 * Порт существовал в ядре как `MeetDataPort` и уже инжектился расширениями по
 * токену — переехал потому, что возвращал `MeetAggregate`, класс с путями
 * `~/...`, которых за пределами монолита нет.
 *
 * Порт **не скоупит доступ**: `username` сужает выборку до собраний, к которым
 * пайщик причастен, но право спрашивать проверяет вызывающий до обращения сюда.
 */

/**
 * Расширенный статус собрания: базовые состояния из цепи плюс выведенные из
 * дат и кворума. Значения — часть контракта: расширение сравнивает с ними
 * напрямую, чтобы решить, слать ли уведомление.
 *
 * Регистрация этого перечня в схеме GraphQL остаётся в ядре: расширениям нужны
 * значения, а не тип поля.
 */
export enum ExtendedMeetStatus {
  NONE = 'none',

  // Состояния, приходящие из цепи
  CREATED = 'created',
  AUTHORIZED = 'authorized',
  PRECLOSED = 'preclosed',
  CLOSED = 'closed',

  // Состояния, выведенные из дат и кворума
  WAITING_FOR_OPENING = 'waitingForOpening',
  VOTING_IN_PROGRESS = 'votingInProgress',
  EXPIRED_NO_QUORUM = 'expiredNoQuorum',
  VOTING_COMPLETED = 'votingCompleted',
  ONRESTART = 'onrestart',
}

/**
 * Строка собрания из цепи.
 *
 * Перечислены поля, которые читают расширения; остальные доступны через
 * индексную сигнатуру. Переписывать всю форму цепи здесь значило бы держать её
 * в синхронизации вручную — понадобится поле, объявляется явно.
 */
export interface InnerMeetRow {
  id: number;
  coopname: string;
  status: string;
  /** Даты приходят разобранными: строку из цепи парсит ядро, а не потребитель. */
  open_at: Date;
  close_at: Date;
  [key: string]: any;
}

/** Собрание в работе: подписи собраны не полностью, состояние ещё меняется. */
export interface InnerMeetProcessing {
  hash: string;
  extendedStatus: ExtendedMeetStatus;
  meet: InnerMeetRow;
}

/**
 * Собрание целиком.
 *
 * Стадии жизненного цикла разделены: `pre` — черновик до публикации в цепь,
 * `processing` — идёт, `processed` — завершено. Заполнена ровно одна.
 * Расширения работают со стадией «идёт», остальные оставлены нетипизированными
 * — обращений к ним замер не показал.
 */
export interface InnerMeet {
  hash: string;
  pre?: Record<string, any> | null;
  processing?: InnerMeetProcessing | null;
  processed?: Record<string, any> | null;
}

/**
 * Черновик собрания: подготовлен, но в цепь ещё не опубликован.
 *
 * Перечислено поле, которое читают расширения; остальное доступно через
 * индексную сигнатуру.
 */
export interface InnerMeetDraft {
  hash: string;
  /** Пояснение к повестке, показываемое пайщику в уведомлении. */
  details?: string | null;
  [key: string]: any;
}

export interface InnerGetMeetsInput {
  coopname: string;
  username?: string;
}

export interface InnerGetMeetInput {
  coopname: string;
  hash: string;
}

export interface IMeetPort {
  getMeets(data: InnerGetMeetsInput, username?: string): Promise<InnerMeet[]>;
  getMeet(data: InnerGetMeetInput, username?: string): Promise<InnerMeet>;

  /**
   * Черновик собрания по хэшу — то, что подготовили до публикации в цепь.
   *
   * Отдельная операция, а не поле в `getMeet`: черновик существует и тогда,
   * когда собрания в цепи ещё нет, и берётся дешёвым поиском по хэшу.
   * Возвращает `null`, если черновика нет.
   */
  getMeetDraft(hash: string): Promise<InnerMeetDraft | null>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────
/**
 * Собрания пайщиков. Провайдер — ядро.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const MEET_PORT = Symbol.for('Innercoop.CorePort.Meet');
