import ecc from 'eosjs-ecc'
import { config } from 'dotenv'

// Ключ берётся из .env стенда; загрузка здесь не зависит от порядка импортов в тесте.
config()

const DOCUMENT_HASH = '157192b276da23cc84ab078fc8755c051c5f0430bf4802e55718221e6b76c777'

/**
 * Подписанный документ для тестов.
 *
 * С 17.09.2026 контракты сверяют подпись с ключом аккаунта подписанта
 * (`verify_signer_keys_or_fail`), поэтому документ подписывается тем же
 * ключом, которым `addUser` создаёт пайщиков на стенде, — `EOSIO_PRV_KEY`.
 * Прежняя фикстура была подписана посторонним ключом и после этой проверки
 * роняла каждое действие, принимающее документ пайщика.
 */
export const fakeDocument = {
  version: '1.0.0',
  hash: DOCUMENT_HASH,
  doc_hash: DOCUMENT_HASH,
  meta_hash: DOCUMENT_HASH,
  meta: '{}',
  signatures: [{
    id: 1,
    signed_hash: DOCUMENT_HASH,
    signer: 'cooperative1',
    // eslint-disable-next-line node/prefer-global/process
    public_key: process.env.EOSIO_PUB_KEY!,
    // eslint-disable-next-line node/prefer-global/process
    signature: ecc.signHash(DOCUMENT_HASH, process.env.EOSIO_PRV_KEY!),
    signed_at: '2025-05-14T12:22:26',
    meta: '{}',
  }],
}
