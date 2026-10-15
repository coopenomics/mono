import { fakeDocument } from '../tests/shared/fakeDocument'

/**
 * Устанавливает подписи документа на основе массива имен аккаунтов
 * @param usernames массив имен аккаунтов для подписи документа
 * @returns документ с подписями
 *
 * С 17.09.2026 контракты сверяют подпись с ключом аккаунта подписанта
 * (`verify_signer_keys_or_fail`). Пайщиков стенда `addUser` заводит ключом
 * `EOSIO_PRV_KEY`, поэтому каждая подпись берёт ключ и подпись из той же
 * фикстуры `fakeDocument` — прежде здесь были вшиты посторонний ключ и готовая
 * подпись, и контракт отклонял каждый документ («Public key does not belong
 * to account»).
 */
export function setDocumentSignatures(usernames: string[]) {
  const [base] = fakeDocument.signatures

  return {
    version: fakeDocument.version,
    hash: fakeDocument.hash,
    doc_hash: fakeDocument.doc_hash,
    meta_hash: fakeDocument.meta_hash,
    meta: fakeDocument.meta,
    signatures: usernames.map((username, index) => ({
      id: index + 1,
      signed_hash: base.signed_hash,
      signer: username,
      public_key: base.public_key,
      signature: base.signature,
      signed_at: base.signed_at,
      meta: '{}',
    })),
  }
}
