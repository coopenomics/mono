import type { SovietContract } from 'cooptypes'
import { PrivateKey, PublicKey, Signature } from '@wharfkit/antelope'
import { Crypto } from '../crypto'

/**
 * Интерфейс для подписи голоса
 */
interface IVoteSignature {
  version: string
  signed_at: string
  signed_hash: string
  signature: string
  public_key: string
}

/**
 * Интерфейс для данных голосования (соответствует параметрам транзакции)
 */
export type IVoteData = SovietContract.Actions.Decisions.VoteFor.IVoteForDecision

/** Действие голосования: контракт привязывает хэш подписи к нему, чтобы голос «за» нельзя было переиспользовать как «против». */
export type VoteAction = 'votefor' | 'voteagainst'

/**
 * Класс для управления и подписания голосов членов совета с использованием WIF-ключа.
 *
 * @example
 * ```typescript
 * const wifKey = "your-wif-private-key";
 * const voteSigner = new Vote(wifKey);
 *
 * // Голосование за решение
 * const voteForResult = await voteSigner.voteFor("coop1", "user1", 123);
 * console.log(voteForResult);
 *
 * // Голосование против решения
 * const voteAgainstResult = await voteSigner.voteAgainst("coop1", "user1", 123);
 * console.log(voteAgainstResult);
 * ```
 */
export class Vote {
  private wif?: PrivateKey

  /**
   * Инициализация класса Vote с WIF-ключом.
   * @param wifKey WIF-ключ, используемый для подписи.
   */
  constructor(wifKey?: string) {
    if (wifKey)
      this.wif = PrivateKey.fromString(wifKey)
  }

  /**
   * Замена текущего WIF-ключа на новый.
   * @param wifKey Новый WIF-ключ.
   */
  public setWif(wifKey: string): void {
    this.wif = PrivateKey.fromString(wifKey)
  }

  /**
   * Секунды эпохи для времени подписи в формате EOSIO (без зоны — всегда UTC).
   */
  private static signedAtSeconds(signed_at: string): number {
    const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(signed_at) ? signed_at : `${signed_at}Z`
    return Math.floor(Date.parse(iso) / 1000)
  }

  /**
   * Хэш, который подписывает член совета: «<действие>:<кооператив>:<номер решения>:<секунды подписи>».
   * Ровно так же его считает контракт soviet (Automation::vote_digest), поэтому подпись
   * привязана к конкретному голосу и не переиспользуется для другого решения или знака голоса.
   */
  public static async buildVoteDigest(action: VoteAction, coopname: string, decision_id: number | string, signed_at: string): Promise<string> {
    const seconds = Vote.signedAtSeconds(signed_at)
    return await Crypto.sha256(`${action}:${coopname}:${decision_id}:${seconds}`)
  }

  /**
   * Создает подпись для голосования
   *
   * @param action Действие голосования (votefor / voteagainst)
   * @param coopname Имя кооператива
   * @param decision_id ID решения
   * @returns Объект подписи голосования
   */
  private async signVote(action: VoteAction, coopname: string, decision_id: number): Promise<IVoteSignature> {
    if (!this.wif)
      throw new Error('Ключ не установлен, выполните вызов метода setWif перед подписью голоса')

    // Версия используемого стандарта подписи
    const version = '1.0.0'

    // Текущая дата в формате EOSIO, с точностью до секунды — ровно то, что попадёт в цепь
    const seconds = Math.floor(Date.now() / 1000)
    const signed_at = new Date(seconds * 1000).toISOString().split('.')[0]

    // Хэш привязан к действию, кооперативу, решению и времени подписи
    const signed_hash = await Vote.buildVoteDigest(action, coopname, decision_id, signed_at)

    // Подписываем хэш
    const signature = this.wif.signDigest(signed_hash)

    // Проверка подписи
    const verified = signature.verifyDigest(signed_hash, this.wif.toPublic())
    if (!verified) {
      throw new Error('Ошибка проверки подписи')
    }

    return {
      version,
      signed_at,
      signed_hash,
      signature: signature.toString(),
      public_key: this.wif.toPublic().toString(),
    }
  }

  /**
   * Подписывает голос "ЗА" решение
   *
   * @param coopname Имя кооператива
   * @param username Имя пользователя (члена совета)
   * @param decision_id ID решения
   * @param permission Разрешение аккаунта, которому принадлежит ключ подписи: active — ручной голос, иное — разрешение робота
   * @returns Объект с параметрами для вызова транзакции votefor
   */
  public async voteFor(coopname: string, username: string, decision_id: number, permission: string = 'active'): Promise<IVoteData> {
    const voteSignature = await this.signVote('votefor', coopname, decision_id)

    return {
      version: voteSignature.version,
      coopname,
      username,
      decision_id,
      signed_at: voteSignature.signed_at,
      signed_hash: voteSignature.signed_hash,
      signature: voteSignature.signature,
      public_key: voteSignature.public_key,
      permission,
    }
  }

  /**
   * Подписывает голос "ПРОТИВ" решения
   *
   * @param coopname Имя кооператива
   * @param username Имя пользователя (члена совета)
   * @param decision_id ID решения
   * @param permission Разрешение аккаунта, которому принадлежит ключ подписи: active — ручной голос, иное — разрешение робота
   * @returns Объект с параметрами для вызова транзакции voteagainst
   */
  public async voteAgainst(coopname: string, username: string, decision_id: number, permission: string = 'active'): Promise<IVoteData> {
    const voteSignature = await this.signVote('voteagainst', coopname, decision_id)

    return {
      version: voteSignature.version,
      coopname,
      username,
      decision_id,
      signed_at: voteSignature.signed_at,
      signed_hash: voteSignature.signed_hash,
      signature: voteSignature.signature,
      public_key: voteSignature.public_key,
      permission,
    }
  }

  /**
   * Статический метод для валидации подписи голоса.
   *
   * @param data Объект с данными голосования
   * @returns true если подпись валидна, иначе false
   */
  public static validateVote(data: IVoteData): boolean {
    try {
      // Проверка версии
      if (data.version !== '1.0.0') {
        return false
      }

      // Проверка, что время подписи не в будущем
      const signedAtDate = new Date(data.signed_at)
      if (signedAtDate > new Date()) {
        return false
      }

      // Проверка подписи
      const publicKeyObj = PublicKey.from(data.public_key)
      const signatureObj = Signature.from(data.signature)
      return signatureObj.verifyDigest(data.signed_hash, publicKeyObj)
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (_) {
      return false
    }
  }

  /**
   * Асинхронная версия метода проверки подписи голоса, которая также проверяет корректность signedHash.
   *
   * @param data Объект с данными голосования
   * @param action Действие голосования, к которому привязан хэш (по умолчанию votefor)
   * @returns Promise<boolean>, который разрешается в true если подпись валидна, иначе false
   */
  public static async validateVoteWithHashCheck(data: IVoteData, action: VoteAction = 'votefor'): Promise<boolean> {
    try {
      // Проверка версии
      if (data.version !== '1.0.0') {
        return false
      }

      // Проверка, что время подписи не в будущем
      const signedAtDate = new Date(data.signed_at)
      if (signedAtDate > new Date()) {
        return false
      }

      // Проверка корректности signedHash: хэш привязан к действию, кооперативу, решению и времени
      const calculatedSignedHash = await Vote.buildVoteDigest(action, data.coopname, data.decision_id, data.signed_at)
      if (calculatedSignedHash.toLowerCase() !== String(data.signed_hash).toLowerCase()) {
        return false
      }

      // Проверка подписи
      const publicKeyObj = PublicKey.from(data.public_key)
      const signatureObj = Signature.from(data.signature)
      return signatureObj.verifyDigest(data.signed_hash, publicKeyObj)
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (_) {
      return false
    }
  }
}
