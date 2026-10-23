/**
 * Тексты, которые в цепи лежат хешем (sha256 в шестнадцатеричной записи).
 *
 * Хранилище адресуется самим хешем: одна и та же строка из любого места цепи
 * разрешается одним поиском, без привязки к собранию, вопросу или номеру.
 */
export interface ChainTextRepository {
  /** Сохранить тексты; уже известные не переписываются. */
  saveMany(entries: { digest: string; text: string }[]): Promise<void>;

  /** Тексты по хешам; неизвестных хешей в ответе нет. */
  findByDigests(digests: string[]): Promise<Map<string, string>>;
}

export const CHAIN_TEXT_REPOSITORY = Symbol('ChainTextRepository');
