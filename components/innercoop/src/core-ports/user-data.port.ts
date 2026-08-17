/**
 * Пользовательские данные пайщика — записи «ключ→значение» в разрезе
 * кооператива.
 *
 * Ими пользуются расширения, которым нужно запомнить о пайщике что-то своё
 * (склонения имени для документов, параметры участия в программе) и прочитать
 * это при следующей подстановке в документ. Раньше инжектился
 * `UDATA_REPOSITORY` по пути `~/domain/common`, которого за пределами монолита
 * нет.
 *
 * Записи версионируются номером блока и удаляются мягко: прежние значения
 * остаются, чтобы документ, подписанный когда-то, можно было воспроизвести
 * ровно в том виде, в каком его подписывали.
 */

/**
 * Одна запись пользовательских данных.
 *
 * `key` — строка, а не перечень: набор ключей задаёт `cooptypes`, а контракт от
 * него не зависит (INV-014). Расширение приносит свой ключ и отвечает за него
 * само.
 */
export interface InnerUserDataRecord {
  coopname: string;
  username: string;
  key: string;
  value: string;
  metadata?: Record<string, any>;
  /** Мягкое удаление: запись остаётся, но перестаёт быть текущей. */
  deleted?: boolean;
  /** Версия записи; у записей, заведённых вне цепи, отсутствует. */
  block_num?: number;
}

/**
 * Новая запись: версию и признак удаления проставляет ядро.
 *
 * Поля перечислены явно, а не через `Omit`: индексной сигнатуры в записи нет
 * намеренно — с ней `Omit` схлопывает форму до «что угодно», и опечатка в
 * имени поля прошла бы молча.
 */
export interface InnerUserDataDraft {
  coopname: string;
  username: string;
  key: string;
  value: string;
  metadata?: Record<string, any>;
}

/** Сужение выборки до конкретной версии или до удалённых записей. */
export interface InnerUserDataFilters {
  metadata?: Record<string, any>;
  block_num?: number;
  deleted?: boolean;
}

export interface IUserDataPort {
  save(record: InnerUserDataDraft): Promise<void>;

  /** Текущее значение ключа; `null`, если записи нет. */
  get(
    coopname: string,
    username: string,
    key: string,
    filters?: InnerUserDataFilters
  ): Promise<InnerUserDataRecord | null>;

  /** Все версии ключа — от свежей к старым. */
  getHistory(coopname: string, username: string, key: string): Promise<InnerUserDataRecord[]>;

  getAll(coopname: string, username?: string): Promise<InnerUserDataRecord[]>;

  remove(coopname: string, username: string, key: string): Promise<void>;
}

export const USER_DATA_PORT = Symbol.for('Innercoop.CorePort.UserData');
