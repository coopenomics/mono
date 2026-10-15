import ecc from 'eosjs-ecc'
import { config } from 'dotenv'

// Ключ берётся из .env стенда; загрузка здесь не зависит от порядка импортов в тесте.
config()

const DOCUMENT_HASH = '157192b276da23cc84ab078fc8755c051c5f0430bf4802e55718221e6b76c777'

/**
 * Подписанный документ для тестов с произвольным хэшем.
 *
 * С 17.09.2026 контракты сверяют подпись с ключом аккаунта подписанта
 * (`verify_signer_keys_or_fail`), поэтому документ подписывается тем же
 * ключом, которым `addUser` создаёт пайщиков на стенде, — `EOSIO_PRV_KEY`.
 * Свой хэш нужен там, где тест различает документы: повторная подпись
 * соглашения обязана заменить doc_hash, а с одной фикстурой его не отличить.
 */
export function signedDocument(hash: string) {
  return {
    version: '1.0.0',
    hash,
    doc_hash: hash,
    meta_hash: hash,
    meta: '{}',
    signatures: [{
      id: 1,
      signed_hash: hash,
      signer: 'cooperative1',
      // Ключ и подпись читаются при обращении, а не при загрузке модуля: фикстуру импортирует рабочий код boot, и весь
      // бандл вычислял бы подпись на любом запуске. `drafts:sync --plan` в плейбуке идёт без ключа и падал на
      // «Invalid private key» ещё до чтения цепи (релиз v2026.9.21).
      get public_key(): string {
        // eslint-disable-next-line node/prefer-global/process
        return process.env.EOSIO_PUB_KEY!
      },
      get signature(): string {
        // eslint-disable-next-line node/prefer-global/process
        return ecc.signHash(hash, process.env.EOSIO_PRV_KEY!)
      },
      signed_at: '2025-05-14T12:22:26',
      meta: '{}',
    }],
  }
}

/** Подписанный документ для тестов (фиксированный хэш). */
export const fakeDocument = signedDocument(DOCUMENT_HASH)
