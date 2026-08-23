import { Injectable, Inject, Logger } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, DocumentRepository } from '../repository/document.repository';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { Classes } from '@coopenomics/sdk';

export const DOCUMENT_VALIDATION_SERVICE = Symbol('DocumentValidationService');

/**
 * Результат валидации одного документа
 */
export interface IDocumentValidationResult {
  /** Идентификатор документа (например, wallet_agreement) */
  id: string | number;
  /** Валиден ли документ */
  is_valid: boolean;
  /** Сообщение об ошибке (если есть) */
  error_message?: string;
  /** Найден ли оригинал в базе */
  original_found: boolean;
  /** Совпадают ли хеши */
  hash_matches: boolean;
  /** Валидны ли подписи */
  signatures_valid: boolean;
}

/**
 * Документ для валидации
 */
export interface IDocumentToValidate {
  /** Идентификатор документа */
  id: string;
  /** Подписанный документ */
  document: ISignedDocument;
}

/**
 * Сервис валидации документов
 * Обеспечивает централизованную проверку подписанных документов с оригиналами в базе
 */
@Injectable()
export class DocumentValidationService {
  private readonly logger = new Logger(DocumentValidationService.name);
  private readonly EMPTY_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(@Inject(DOCUMENT_REPOSITORY) private readonly documentRepository: DocumentRepository) {}

  /**
   * Полная валидация подписанного документа
   * Включает проверку подписей и сверку с оригиналом в базе
   * @param id - идентификатор документа
   * @param signedDoc - подписанный документ
   * @returns результат валидации
   */
  async validateSignedDocument(id: string, signedDoc: ISignedDocument): Promise<IDocumentValidationResult> {
    const result: IDocumentValidationResult = {
      id,
      is_valid: false,
      original_found: false,
      hash_matches: false,
      signatures_valid: false,
    };

    try {
      // 1. Проверяем подписи через SDK
      result.signatures_valid = this.verifySignatures(signedDoc);
      if (!result.signatures_valid) {
        result.error_message = `Документ "${id}" имеет недействительные подписи`;
        this.logger.warn(result.error_message);
        return result;
      }

      // 2. Проверяем структуру документа через SDK
      const isStructureValid = Classes.Document.validateDocument(signedDoc);
      if (!isStructureValid) {
        result.error_message = `Документ "${id}" не прошел структурную валидацию`;
        this.logger.warn(result.error_message);
        return result;
      }

      // 3. Сверяем с оригиналом в базе
      const hashCheckResult = await this.verifyDocumentHash(signedDoc);
      result.original_found = hashCheckResult.found;
      result.hash_matches = hashCheckResult.matches;

      if (!result.original_found) {
        result.error_message = `Оригинал документа "${id}" не найден в базе`;
        this.logger.warn(result.error_message);
        return result;
      }

      if (!result.hash_matches) {
        result.error_message = `Хеш документа "${id}" не совпадает с оригиналом`;
        this.logger.warn(result.error_message);
        return result;
      }

      // Все проверки пройдены
      result.is_valid = true;
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      result.error_message = `Ошибка валидации документа "${id}": ${errorMessage}`;
      this.logger.error(result.error_message);
      return result;
    }
  }

  /**
   * Проверка подписей документа
   * @param signedDoc - подписанный документ
   * @returns true если все подписи валидны
   */
  verifySignatures(signedDoc: ISignedDocument): boolean {
    if (!signedDoc.signatures || signedDoc.signatures.length === 0) {
      return false;
    }

    for (const signature of signedDoc.signatures) {
      const isValid = Classes.Document.validateSignature(signature);
      if (!isValid) {
        return false;
      }
    }

    return true;
  }

  /**
   * Сверка хеша документа с оригиналом в базе
   * @param signedDoc - подписанный документ
   * @returns объект с флагами found и matches
   */
  async verifyDocumentHash(signedDoc: ISignedDocument): Promise<{ found: boolean; matches: boolean }> {
    const { doc_hash } = signedDoc;

    // Пустой хеш - документ не был сохранен
    if (doc_hash === this.EMPTY_HASH) {
      return { found: false, matches: false };
    }

    // Ищем оригинал в базе
    const original = await this.documentRepository.findByHash(doc_hash);

    if (!original) {
      return { found: false, matches: false };
    }

    // Сверяем хеши
    const matches = original.hash === doc_hash;

    return { found: true, matches };
  }

  /**
   * Пакетная валидация документов для регистрации
   * @param documents - массив документов для валидации
   * @returns массив результатов валидации
   */
  async validateRegistrationDocuments(documents: IDocumentToValidate[]): Promise<IDocumentValidationResult[]> {
    this.logger.log(`Начало валидации ${documents.length} документов`);

    const results = await Promise.all(documents.map((doc) => this.validateSignedDocument(doc.id, doc.document)));

    // Проверяем, все ли документы валидны
    const invalidDocs = results.filter((r) => !r.is_valid);
    if (invalidDocs.length > 0) {
      const errors = invalidDocs.map((r) => r.error_message).join('; ');
      this.logger.error(`Найдены невалидные документы: ${errors}`);
    } else {
      this.logger.log(`Все ${documents.length} документов прошли валидацию`);
    }

    return results;
  }

  /**
   * Проверяет, все ли документы в массиве валидны
   * @param results - результаты валидации
   * @returns true если все документы валидны
   */
  allDocumentsValid(results: IDocumentValidationResult[]): boolean {
    return results.every((r) => r.is_valid);
  }

  /**
   * Получить сообщения об ошибках из результатов валидации
   * @param results - результаты валидации
   * @returns массив сообщений об ошибках
   */
  getErrorMessages(results: IDocumentValidationResult[]): string[] {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return results.filter((r) => !r.is_valid && r.error_message).map((r) => r.error_message!);
  }
}
