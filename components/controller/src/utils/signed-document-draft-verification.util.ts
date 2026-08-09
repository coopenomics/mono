import httpStatus from 'http-status';
import { Classes } from '@coopenomics/sdk';
import type { InnerGeneratedDocument, ISignedDocument } from '@coopenomics/innercoop';
import { HttpApiError } from '~/utils/httpApiError';
import { CurrencyValidationUtil } from '~/utils/currency-validation.util';

/** Режим сравнения `signed.meta[field]` с ожидаемым значением */
export type SignedDocumentMetaCompareMode = 'currency_amount' | 'string_trim' | 'hex_case_insensitive';

export interface SignedDocumentMetaVerification {
  /** Имя поля в объекте `signed.meta` */
  field: string;
  /** Ожидаемое значение (из мутации / доменного ввода) */
  expected: string;
  /** Как сравнивать */
  mode: SignedDocumentMetaCompareMode;
}

/**
 * Загрузка сгенерированного черновика из хранилища по `doc_hash` подписанного документа.
 */
export type LoadGeneratedDocumentByDocHash = (docHash: string) => Promise<InnerGeneratedDocument | null>;

/**
 * 1) Находит в БД черновик по `signed.doc_hash`.
 * 2) Глубокая сверка подписанного документа с черновиком через {@link Classes.Document.compareDocuments}.
 * 3) Опционально: сверка одного или нескольких полей `signed.meta[field]` с ожидаемыми значениями.
 *
 * Паттерн как в {@link ResultSubmissionService.pushResult}.
 */
export async function verifySignedDocumentAgainstStoredDraft(
  loadGeneratedByDocHash: LoadGeneratedDocumentByDocHash,
  signed: ISignedDocument,
  metaVerifications?: SignedDocumentMetaVerification[],
): Promise<void> {
  const generated = await loadGeneratedByDocHash(signed.doc_hash);
  if (!generated) {
    throw new HttpApiError(
      httpStatus.BAD_REQUEST,
      `Сгенерированный документ с хешем ${signed.doc_hash} не найден. Сначала сгенерируйте документ.`,
    );
  }

  // InnerGeneratedDocument по сути совместим с IGeneratedDocument для compareDocuments (см. ResultSubmissionService)
  const comparison = await Classes.Document.compareDocuments(signed as any, generated as any);
  if (!comparison.isValid) {
    const differences = Object.entries(comparison.differences)
      .map(([field, values]) => `${field}: ожидалось "${values.expected}", получено "${values.actual}"`)
      .join('; ');
    throw new HttpApiError(
      httpStatus.BAD_REQUEST,
      `Сверка подписанного документа с черновиком не прошла: ${differences}. Возможна подмена документа.`,
    );
  }

  if (!metaVerifications || metaVerifications.length === 0) {
    return;
  }

  const meta = signed.meta as Record<string, unknown>;

  for (const { field, expected, mode } of metaVerifications) {
    const raw = meta[field];
    const actualStr =
      typeof raw === 'string' ? raw.trim() : raw !== undefined && raw !== null ? String(raw).trim() : '';

    if (!actualStr) {
      throw new HttpApiError(
        httpStatus.BAD_REQUEST,
        `В метаданных документа отсутствует поле «${field}», требуемое для сверки.`,
      );
    }

    const expectedTrimmed = expected.trim();

    switch (mode) {
      case 'currency_amount': {
        const parsedExpected = CurrencyValidationUtil.extractAmountValue(expectedTrimmed);
        const parsedActual = CurrencyValidationUtil.extractAmountValue(actualStr);
        if (Number.isNaN(parsedExpected) || Number.isNaN(parsedActual)) {
          throw new HttpApiError(httpStatus.BAD_REQUEST, `Некорректный формат суммы в поле «${field}» или в ожидаемом значении.`);
        }
        if (CurrencyValidationUtil.formatAmount(parsedExpected) !== CurrencyValidationUtil.formatAmount(parsedActual)) {
          throw new HttpApiError(
            httpStatus.BAD_REQUEST,
            `Значение поля «${field}» в документе (${actualStr}) не совпадает с ожидаемым (${expectedTrimmed}). Возможна подмена документа.`,
          );
        }
        break;
      }
      case 'string_trim': {
        if (actualStr !== expectedTrimmed) {
          throw new HttpApiError(
            httpStatus.BAD_REQUEST,
            `Значение поля «${field}» в документе (${actualStr}) не совпадает с ожидаемым (${expectedTrimmed}). Возможна подмена документа.`,
          );
        }
        break;
      }
      case 'hex_case_insensitive': {
        if (actualStr.toLowerCase() !== expectedTrimmed.toLowerCase()) {
          throw new HttpApiError(
            httpStatus.BAD_REQUEST,
            `Значение поля «${field}» в документе (${actualStr}) не совпадает с ожидаемым (${expectedTrimmed}). Возможна подмена документа.`,
          );
        }
        break;
      }
      default:
        throw new HttpApiError(httpStatus.INTERNAL_SERVER_ERROR, `Неизвестный режим сравнения meta: ${String(mode)}`);
    }
  }
}
