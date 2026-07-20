import type { IGeneratedDocument, ISignatureInfo, ISignatureInfoInput, ISignedChainDocument, ISignedDocument } from '../../types/document'
import { PrivateKey, PublicKey, Signature } from '@wharfkit/antelope'
import canonicalize from 'canonicalize'
import { Crypto } from '../crypto'

/** Актуальная версия алгоритма подписи для новых документов (детерминированная канонизация meta через JCS RFC 8785). */
export const CURRENT_DOCUMENT_VERSION = '1.1.0'

/**
 * Класс для управления и подписания документов с использованием WIF-ключа.
 *
 * @example
 * ```typescript
 * const wifKey = "your-wif-private-key";
 * const docSigner = new Document(wifKey);
 *
 * const generatedDoc: IGeneratedDocument = {
 *   full_title: "Пример документа",
 *   html: "<p>Это пример документа</p>",
 *   hash: "hash_of_document",
 *   meta: { author: "Автор документа" },
 *   binary: "binary_data"
 * };
 *
 * const signedDoc = await docSigner.signDocument(generatedDoc);
 * console.log(signedDoc);
 *
 * // Замена WIF-ключа
 * docSigner.setWif("new-wif-private-key");
 * ```
 */
export class Document {
  private wif?: PrivateKey

  /**
   * Инициализация класса Document с WIF-ключом.
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
   * Вычисляет meta_hash, hash и signed_hash по актуальной логике в зависимости от версии.
   */
  private async calculateHashes({ meta, documentHash, signed_at, version = '1.0.0' }: { meta: any, documentHash: string, signed_at: string, version?: string }): Promise<{ meta_hash: string, hash: string, signed_hash: string }> {
    const { meta_hash, hash, signed_hash } = await Document.calculateDocumentHashes(meta, documentHash, signed_at, version)
    return { meta_hash, hash, signed_hash }
  }

  /**
   * Статический метод для вычисления хэшей документа.
   * Вычисляет meta_hash, hash и signed_hash по актуальной логике в зависимости от версии.
   */
  public static async calculateDocumentHashes(
    meta: any,
    documentHash: string,
    signed_at: string,
    version: string = '1.0.0',
  ): Promise<{ meta_hash: string, hash: string, signed_hash: string }> {
    if (version === '1.0.0' || !version) {
      // Legacy: недетерминированная канонизация — JSON.stringify(meta) зависит от порядка ключей.
      const meta_hash = await Crypto.sha256(JSON.stringify(meta))
      const hash = await Crypto.sha256(meta_hash + documentHash)
      const signed_hash = await Crypto.sha256(hash + signed_at)
      return { meta_hash, hash, signed_hash }
    }

    if (version === '1.1.0') {
      // Детерминированная канонизация meta через JCS (RFC 8785) — порядок ключей не влияет на meta_hash.
      // Та же либа `canonicalize`, что в верификаторе документов → meta_hash совпадает байт-в-байт.
      // Остальная цепочка (hash, signed_hash) и регистры — идентичны 1.0.0; меняется только источник meta_hash.
      const canonicalMeta = canonicalize(meta)
      if (canonicalMeta === undefined)
        throw new Error('JCS: значение meta не сериализуемо (undefined/function/symbol)')
      const meta_hash = await Crypto.sha256(canonicalMeta)
      const hash = await Crypto.sha256(meta_hash + documentHash)
      const signed_hash = await Crypto.sha256(hash + signed_at)
      return { meta_hash, hash, signed_hash }
    }

    throw new Error(`Неизвестная версия алгоритма: ${version}`)
  }

  /**
   * Подписывает документ и возвращает его в формате ISignedDocument.
   * @param document Сгенерированный документ для подписи.
   * @param account Имя аккаунта подписывающего (signer)
   * @param signatureId ID подписи (обычно 1 для первой подписи)
   * @param existingSignedDocuments Массив уже подписанных документов для объединения подписей
   * @returns Подписанный документ.
   */
  public async signDocument(
    document: IGeneratedDocument,
    account: string,
    signatureId: number = 1,
    existingSignedDocuments?: ISignedDocument[],
  ): Promise<ISignedDocument> {
    const version = CURRENT_DOCUMENT_VERSION

    if (!this.wif)
      throw new Error(`Ключ не установлен, выполните вызов метода setWif перед подписью документа`)

    // Текущая дата в формате EOSIO
    const now = new Date()
    const signed_at = now.toISOString().split('.')[0]

    // Вычисляем все хэши через отдельную функцию, передавая версию
    const { meta_hash, hash, signed_hash } = await this.calculateHashes({ meta: document.meta, documentHash: document.hash, signed_at, version })

    // Собираем все существующие подписи из переданных документов
    const allSignatures: ISignatureInfoInput[] = []

    if (existingSignedDocuments && existingSignedDocuments.length > 0) {
      for (const existingDoc of existingSignedDocuments) {
        // Проверяем совместимость хэшей
        if (existingDoc.doc_hash.toUpperCase() !== document.hash.toUpperCase()) {
          throw new Error(`Хэш документа не совпадает с существующим подписанным документом: ${existingDoc.doc_hash.toUpperCase()} !== ${document.hash.toUpperCase()}`)
        }

        if (existingDoc.meta_hash.toUpperCase() !== meta_hash.toUpperCase()) {
          throw new Error(`Хэш метаданных не совпадает с существующим подписанным документом: ${existingDoc.meta_hash.toUpperCase()} !== ${meta_hash.toUpperCase()}`)
        }

        // Верифицируем существующие подписи
        for (const existingSignature of existingDoc.signatures) {
          if (!Document.validateSignature(existingSignature)) {
            throw new Error(`Недействительная подпись от ${existingSignature.signer} с ID ${existingSignature.id}`)
          }
        }

        // Добавляем подписи к общему массиву
        allSignatures.push(...existingDoc.signatures.map((sig) => {
          // Исключаем лишние поля, которые не нужны для SignatureInfoInput
          const { is_valid, signer_certificate, ...cleanedSig } = sig
          return cleanedSig as ISignatureInfo
        }))
      }
    }

    // Проверяем, что signatureId не дублируется
    const existingIds = allSignatures.map(sig => sig.id)
    if (existingIds.includes(signatureId)) {
      throw new Error(`Подпись с ID ${signatureId} уже существует`)
    }

    // Подпись хэша документа
    const digitalSignature = this.signDigest(signed_hash)

    // Создаем информацию о новой подписи
    const newSignatureInfo: ISignatureInfoInput = {
      id: signatureId,
      signer: account,
      public_key: digitalSignature.public_key,
      signature: digitalSignature.signature,
      signed_at,
      signed_hash,
      meta: JSON.stringify({}),
    }

    // Добавляем новую подпись к существующим
    allSignatures.push(newSignatureInfo)

    // Сортируем подписи по ID
    allSignatures.sort((a, b) => a.id - b.id)

    return {
      version,
      hash,
      doc_hash: document.hash, // TODO: после миграции фабрики заменить здесь на doc_hash взятый из фабрики
      meta_hash,
      meta: document.meta,
      signatures: allSignatures,
    }
  }

  /**
   * Подписывает хэш (digest) документа и проверяет подпись.
   * @param digest Хэш документа для подписи.
   * @returns Детали подписи.
   */
  private signDigest(digest: string): IMessageSignature {
    if (!this.wif)
      throw new Error(`Ключ не установлен, выполните вызов метода setWif перед подписью документа`)

    // Подпись хэша документа
    const signed = this.wif.signDigest(digest)
    // Проверка подписи с использованием публичного ключа
    const verified = signed.verifyDigest(digest, this.wif.toPublic())

    if (!verified) {
      throw new Error('Ошибка проверки подписи')
    }

    return {
      message: digest,
      signature: signed.toString(),
      public_key: this.wif.toPublic().toString(),
    }
  }

  /**
   * Статический метод для валидации подписанного документа.
   * Проверяет корректность дат, подписей и их порядок.
   *
   * @param document Подписанный документ для проверки
   * @returns true если документ валиден, иначе false
   */
  public static validateDocument(document: ISignedDocument): boolean {
    try {
      const { signatures } = document

      // Проверка наличия подписей
      if (!signatures || signatures.length === 0) {
        return false
      }

      // Проверка сортировки и последовательности id
      for (let i = 0; i < signatures.length; i++) {
        // Проверка, что id начинаются с 0 или 1 и увеличиваются последовательно
        if ((signatures[i].id !== i && signatures[i].id !== i + 1)) {
          return false
        }

        // Проверка подписи
        try {
          const publicKeyObj = PublicKey.from(signatures[i].public_key)
          const signatureObj = Signature.from(signatures[i].signature)
          const verified = signatureObj.verifyDigest(signatures[i].signed_hash, publicKeyObj)

          if (!verified) {
            return false
          }
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
        catch (_) {
          return false
        }
      }

      return true
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (_) {
      return false
    }
  }

  /**
   * Статический метод для преобразования подписанного документа в формат для блокчейна.
   * Преобразует метаданные в строки JSON.
   *
   * @param document Подписанный документ для финализации
   * @returns Документ в формате для отправки в блокчейн
   */
  public static finalize(document: ISignedDocument): ISignedChainDocument {
    // Преобразуем meta документа в строку JSON
    const stringifiedMeta = JSON.stringify(document.meta)

    // Преобразуем meta в каждой подписи
    const finalizedSignatures = document.signatures.map(sig => ({
      ...sig,
      meta: typeof sig.meta === 'object' ? JSON.stringify(sig.meta) : sig.meta,
    }))

    return {
      version: document.version,
      hash: document.hash,
      doc_hash: document.doc_hash,
      meta_hash: document.meta_hash,
      meta: stringifiedMeta,
      signatures: finalizedSignatures,
    }
  }

  /**
   * Статический метод для преобразования документа из формата блокчейна в стандартный формат.
   * Преобразует строки JSON метаданных в объекты.
   *
   * @param document Документ в формате блокчейна
   * @returns Стандартный подписанный документ
   */
  public static parse(document: ISignedChainDocument): ISignedDocument {
    // Преобразуем строку meta документа в объект
    const parsedMeta = typeof document.meta === 'string' ? JSON.parse(document.meta) : document.meta

    // Преобразуем meta в каждой подписи из строки в объект, если это строка
    const parsedSignatures = document.signatures.map(sig => ({
      ...sig,
      meta: typeof sig.meta === 'string' && sig.meta !== '' ? JSON.parse(sig.meta) : sig.meta,
    }))

    return {
      version: document.version,
      hash: document.hash,
      doc_hash: document.doc_hash,
      meta_hash: document.meta_hash,
      meta: parsedMeta,
      signatures: parsedSignatures,
    }
  }

  /**
   * Статический метод для валидации отдельной подписи документа.
   * Проверяет корректность даты и цифровой подписи.
   *
   * @param signature Информация о подписи для проверки
   * @returns true если подпись валидна, иначе false
   */
  public static validateSignature(signature: ISignatureInfo): boolean {
    try {
      // Проверка подписи
      const publicKeyObj = PublicKey.from(signature.public_key)
      const signatureObj = Signature.from(signature.signature)
      const verified = signatureObj.verifyDigest(signature.signed_hash, publicKeyObj)

      return verified
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (_) {
      return false
    }
  }

  /**
   * Статический метод для создания не подписанной версии документа из сгенерированного документа.
   * Вычисляет все необходимые хэши, но не добавляет подписи.
   * Полезно для сверки и сравнения документов.
   *
   * @param document Сгенерированный документ для преобразования
   * @param version Версия алгоритма расчета хэшей (по умолчанию '1.0.0')
   * @returns Документ в формате ISignedDocument без подписей
   *
   * @example
   * ```typescript
   * const generatedDoc: IGeneratedDocument = { ... };
   * const unsignedDoc = Document.createUnsignedDocument(generatedDoc);
   * console.log(unsignedDoc); // Документ без подписей для сверки
   * ```
   */
  public static async createUnsignedDocument(
    document: IGeneratedDocument,
    version: string = '1.0.0',
  ): Promise<ISignedDocument> {
    // Вычисляем meta_hash и hash через calculateDocumentHashes
    // Используем пустую строку для signed_at поскольку подпись не требуется
    const { meta_hash, hash } = await Document.calculateDocumentHashes(
      document.meta,
      document.hash,
      '',
      version,
    )

    return {
      version,
      hash,
      doc_hash: document.hash,
      meta_hash,
      meta: document.meta,
      signatures: [], // Пустой массив подписей
    }
  }

  /**
   * Статический метод для сверки подписанного и сгенерированного документов.
   * Преобразует сгенерированный документ в неподписанную версию и сравнивает хэши.
   * Поскольку хэши включают всю информацию о документе, достаточно сравнить только их.
   *
   * @param signedDocument Подписанный документ для сверки
   * @param generatedDocument Сгенерированный документ для сверки
   * @param version Версия алгоритма расчета хэшей (по умолчанию '1.0.0')
   * @returns Объект с результатами сверки по хэшам
   *
   * @example
   * ```typescript
   * const signedDoc: ISignedDocument = { ... };
   * const generatedDoc: IGeneratedDocument = { ... };
   * const comparison = await Document.compareDocuments(signedDoc, generatedDoc);
   * if (comparison.isValid) {
   *   console.log('Документы совпадают');
   * } else {
   *   console.log('Различия:', comparison.differences);
   * }
   * ```
   */
  public static async compareDocuments(
    signedDocument: ISignedDocument,
    generatedDocument: IGeneratedDocument,
    version?: string,
  ): Promise<{ isValid: boolean, differences: Record<string, { expected: string, actual: string }> }> {
    // Версию алгоритма берём из самого подписанного документа (1.0.0 legacy / 1.1.0 JCS),
    // если явно не передана — иначе старый дефолт 1.0.0 ломал бы сверку 1.1.0-документов.
    const effectiveVersion = version ?? signedDocument.version ?? '1.0.0'

    // Создаем неподписанную версию из сгенерированного документа
    const unsignedDocument = await Document.createUnsignedDocument(generatedDocument, effectiveVersion)

    const differences: Record<string, { expected: string, actual: string }> = {}

    // Сравниваем хэши и версию (остальные поля проверяются через хэши)
    const fieldsToCompare = ['version', 'hash', 'doc_hash', 'meta_hash'] as const

    for (const field of fieldsToCompare) {
      if (signedDocument[field] !== unsignedDocument[field]) {
        differences[field] = {
          expected: unsignedDocument[field],
          actual: signedDocument[field],
        }
      }
    }

    return {
      isValid: Object.keys(differences).length === 0,
      differences,
    }
  }

  /**
   * Статический метод для валидации подписей документа по списку username.
   * Проверяет наличие подписей от указанных пользователей и их валидность.
   * Выбрасывает ошибку если валидация не прошла.
   *
   * @param document Подписанный документ для проверки
   * @param requiredSigners Массив username, чьи подписи должны присутствовать и быть валидными
   * @throws Error с описанием причины неудачи валидации
   *
   * @example
   * ```typescript
   * try {
   *   Document.assertDocumentSignatures(signedDocument, ['user1', 'user2']);
   *   console.log('Все требуемые подписи присутствуют и валидны');
   * } catch (error) {
   *   console.error('Ошибка валидации:', error.message);
   * }
   * ```
   */
  public static assertDocumentSignatures(document: ISignedDocument, requiredSigners: string[]): void {
    if (!document || !document.signatures) {
      throw new Error('Документ не содержит подписей')
    }

    if (!requiredSigners || requiredSigners.length === 0) {
      throw new Error('Список требуемых подписантов не может быть пустым')
    }

    // Получаем уникальные username из подписей документа
    const documentSigners = new Set(document.signatures.map(sig => sig.signer))

    // Проверяем наличие всех требуемых подписей
    const missingSigners = requiredSigners.filter(signer => !documentSigners.has(signer))
    if (missingSigners.length > 0) {
      throw new Error(`Отсутствуют подписи от следующих пользователей: ${missingSigners.join(', ')}`)
    }

    // Проверяем валидность подписей от требуемых пользователей
    const invalidSignatures: string[] = []

    for (const requiredSigner of requiredSigners) {
      // Находим подписи от этого пользователя
      const signerSignatures = document.signatures.filter(sig => sig.signer === requiredSigner)

      if (signerSignatures.length === 0) {
        throw new Error(`Подпись от пользователя ${requiredSigner} не найдена`)
      }

      // Проверяем валидность каждой подписи от этого пользователя
      for (const signature of signerSignatures) {
        if (!Document.validateSignature(signature)) {
          invalidSignatures.push(requiredSigner)
          break // Достаточно одной невалидной подписи от пользователя
        }
      }
    }

    if (invalidSignatures.length > 0) {
      throw new Error(`Недействительные подписи от следующих пользователей: ${invalidSignatures.join(', ')}`)
    }
  }
}

/**
 * Интерфейс для данных подписи сообщения.
 */
interface IMessageSignature {
  message: string // Сообщение (хэш), которое было подписано
  signature: string // Цифровая подпись сообщения
  public_key: string // Публичный ключ, использованный для подписи
}
