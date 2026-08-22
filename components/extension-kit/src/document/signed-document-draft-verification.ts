import { HttpStatus } from '@nestjs/common';
import { Classes } from '@coopenomics/sdk';
import { HttpApiError } from '../errors/http-api-error';
import { CurrencyValidationUtil } from '../utils/currency-validation.utils';

/**
 * Сверка подписанного документа с черновиком, который ему предшествовал.
 *
 * Пайщик подписывает то, что увидел на экране, а расширение принимает подпись
 * отдельным вызовом — между этими двумя моментами содержимое можно подменить.
 * Поэтому расширение обязано найти свой же черновик по хэшу и сверить его с
 * подписанным, а не верить присланному. Правило одно для всех, кто принимает
 * подписи, поэтому живёт в каркасе в единственном экземпляре.
 *
 * Формы документов описаны структурно, а не импортом из
 * `@coopenomics/innercoop`: пакеты ортогональны (INV-007).
 */

/** Режим сравнения `signed.meta[field]` с ожидаемым значением. */
export type SignedDocumentMetaCompareMode = 'currency_amount' | 'string_trim' | 'hex_case_insensitive';

export interface SignedDocumentMetaVerification {
  /** Имя поля в объекте `signed.meta`. */
  field: string;
  /** Ожидаемое значение — из мутации либо доменного ввода. */
  expected: string;
  /** Как сравнивать. */
  mode: SignedDocumentMetaCompareMode;
}

/** Подписанный документ: отсюда берутся хэш черновика и метаданные подписи. */
export interface SignedDocumentToVerify {
  doc_hash: string;
  meta: unknown;
}

/** Черновик, сохранённый при генерации. */
export interface GeneratedDocumentDraft {
  hash: string;
}

/** Загрузка сохранённого черновика по `doc_hash` подписанного документа. */
export type LoadGeneratedDocumentByDocHash = (docHash: string) => Promise<GeneratedDocumentDraft | null>;

/**
 * 1) Находит черновик по `signed.doc_hash`.
 * 2) Сверяет подписанный документ с черновиком через `Classes.Document.compareDocuments`.
 * 3) Опционально сверяет поля `signed.meta` с ожидаемыми значениями.
 *
 * Бросает `HttpApiError` с 400, если черновик не найден, содержимое разошлось
 * или метаданные не совпали: всё это — признаки подмены, а не ошибки ввода.
 */
export async function verifySignedDocumentAgainstStoredDraft(
  loadGeneratedByDocHash: LoadGeneratedDocumentByDocHash,
  signed: SignedDocumentToVerify,
  metaVerifications?: SignedDocumentMetaVerification[]
): Promise<void> {
  const generated = await loadGeneratedByDocHash(signed.doc_hash);
  if (!generated) {
    throw new HttpApiError(
      HttpStatus.BAD_REQUEST,
      `Сгенерированный документ с хешем ${signed.doc_hash} не найден. Сначала сгенерируйте документ.`
    );
  }

  const comparison = await Classes.Document.compareDocuments(signed as any, generated as any);
  if (!comparison.isValid) {
    const differences = Object.entries(comparison.differences)
      .map(([field, values]) => `${field}: ожидалось "${values.expected}", получено "${values.actual}"`)
      .join('; ');
    throw new HttpApiError(
      HttpStatus.BAD_REQUEST,
      `Сверка подписанного документа с черновиком не прошла: ${differences}. Возможна подмена документа.`
    );
  }

  if (!metaVerifications || metaVerifications.length === 0) {
    return;
  }

  const meta = (signed.meta ?? {}) as Record<string, unknown>;

  for (const { field, expected, mode } of metaVerifications) {
    const raw = meta[field];
    const actualStr =
      typeof raw === 'string' ? raw.trim() : raw !== undefined && raw !== null ? String(raw).trim() : '';

    if (!actualStr) {
      throw new HttpApiError(
        HttpStatus.BAD_REQUEST,
        `В метаданных документа отсутствует поле «${field}», требуемое для сверки.`
      );
    }

    const expectedTrimmed = expected.trim();

    switch (mode) {
      case 'currency_amount': {
        const parsedExpected = CurrencyValidationUtil.extractAmountValue(expectedTrimmed);
        const parsedActual = CurrencyValidationUtil.extractAmountValue(actualStr);
        if (Number.isNaN(parsedExpected) || Number.isNaN(parsedActual)) {
          throw new HttpApiError(
            HttpStatus.BAD_REQUEST,
            `Некорректный формат суммы в поле «${field}» или в ожидаемом значении.`
          );
        }
        if (CurrencyValidationUtil.formatAmount(parsedExpected) !== CurrencyValidationUtil.formatAmount(parsedActual)) {
          throw new HttpApiError(
            HttpStatus.BAD_REQUEST,
            `Значение поля «${field}» в документе (${actualStr}) не совпадает с ожидаемым (${expectedTrimmed}). Возможна подмена документа.`
          );
        }
        break;
      }
      case 'string_trim': {
        if (actualStr !== expectedTrimmed) {
          throw new HttpApiError(
            HttpStatus.BAD_REQUEST,
            `Значение поля «${field}» в документе (${actualStr}) не совпадает с ожидаемым (${expectedTrimmed}). Возможна подмена документа.`
          );
        }
        break;
      }
      case 'hex_case_insensitive': {
        if (actualStr.toLowerCase() !== expectedTrimmed.toLowerCase()) {
          throw new HttpApiError(
            HttpStatus.BAD_REQUEST,
            `Значение поля «${field}» в документе (${actualStr}) не совпадает с ожидаемым (${expectedTrimmed}). Возможна подмена документа.`
          );
        }
        break;
      }
      default:
        throw new HttpApiError(HttpStatus.INTERNAL_SERVER_ERROR, `Неизвестный режим сравнения meta: ${String(mode)}`);
    }
  }
}
