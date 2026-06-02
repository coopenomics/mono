import { z } from 'zod';

/**
 * Story 6.3 (Epic 6): Zod-схемы валидации структуры `IChainDocument2` ДО
 * нормализации в `ISignedDocumentDomainInterface`. Если контракт COOPOS меняет
 * форму signature info или забывает заполнить поле — schema-parse падает с явным
 * сообщением, mapper в try/catch отдаёт null + warn (Story 6.5 unknown-version
 * сделает явный alert).
 *
 * OQ-13 (план эпика 6): хранятся ВСЕ подписанты массивом, primary не выделяется.
 * UI сам решает, кого показать главным. Базовая схема — стандартный мультисиг-контракт
 * кооператива (≥1 подпись); для двухподписных актов есть отдельная refine.
 */

export const signatureInfoSchema = z.object({
  public_key: z.string().min(1),
  signature: z.string().min(1),
  /** time_point_sec в виде строки YYYY-MM-DDTHH:mm:ss(.SSS)?. */
  signed_at: z.string().min(1),
  meta: z.string(),
});

export type SignatureInfoSchema = z.infer<typeof signatureInfoSchema>;

/**
 * Базовая схема `IChainDocument2`: ≥1 подпись. Подходит для большинства подписанных
 * документов (приложения к ТЭМ, заявления пайщика, и т.д.).
 */
export const chainDocumentSchema = z.object({
  version: z.string().min(1),
  hash: z.string().min(1),
  doc_hash: z.string().min(1),
  meta_hash: z.string().min(1),
  meta: z.string(),
  signatures: z.array(signatureInfoSchema).min(1, 'минимум одна подпись'),
});

export type ChainDocumentSchema = z.infer<typeof chainDocumentSchema>;

/**
 * Документы с ровно одной подписью (например, приложение `appendix` — один автор).
 */
export const singleSignatureChainDocumentSchema = chainDocumentSchema.extend({
  signatures: z.array(signatureInfoSchema).length(1, 'требуется ровно одна подпись'),
});

/**
 * Двухподписные акты кооператива: `signsupp/signchair` (Стол заказов, marketplace2),
 * `signact1/signact2` (универсальный канон capital). Оба подписанта хранятся в одном
 * массиве `signatures` — primary не выделяется (OQ-13).
 */
export const twoSignatureChainDocumentSchema = chainDocumentSchema.extend({
  signatures: z.array(signatureInfoSchema).length(2, 'требуется ровно две подписи'),
});
