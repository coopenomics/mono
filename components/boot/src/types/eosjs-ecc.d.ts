/**
 * Типы для `eosjs-ecc`: библиотека их не поставляет, а без объявления
 * компилятор роняет каждый её импорт (TS7016). Объявлены ровно те функции,
 * которыми пользуются сценарии загрузки; появится новая — дописать сюда,
 * а не возвращать `any` на весь модуль.
 */
declare module 'eosjs-ecc' {
  /** Случайный приватный ключ в формате WIF. */
  export function randomKey(cpuEntropyBits?: number): Promise<string>
  /** Детерминированный приватный ключ из строки-семени. */
  export function seedPrivate(seed: string): string
  /** Публичный ключ из приватного. */
  export function privateToPublic(wif: string, pubkeyPrefix?: string): string
  /** SHA-256 от строки или буфера. */
  export function sha256(
    data: string | Buffer,
    resultEncoding?: string,
    encoding?: string,
  ): string
  /** Подпись готового хеша приватным ключом. */
  export function signHash(
    dataSha256: string | Buffer,
    privateKey: string,
    encoding?: string,
  ): string

  const ecc: {
    randomKey: typeof randomKey
    seedPrivate: typeof seedPrivate
    privateToPublic: typeof privateToPublic
    sha256: typeof sha256
    signHash: typeof signHash
  }
  export default ecc
}
