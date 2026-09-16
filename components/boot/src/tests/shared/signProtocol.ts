import { createHash } from 'node:crypto'
import { private_key } from '../../configs'

/**
 * Протокол решения совета с настоящей подписью председателя в формате цепи (document2).
 *
 * Контракт при утверждении требует подпись председателя на протоколе и проверяет, что её
 * ключ принадлежит указанному разрешению его аккаунта. Сам протокол здесь не из фабрики:
 * для контрактных тестов достаточно любого документа с корректной цепочкой хэшей и подписью.
 *
 * @param chairman аккаунт председателя (подписант)
 * @param decision_id номер решения — попадает в meta, чтобы хэши разных протоколов не совпадали
 * @param wif ключ подписи (по умолчанию ключ стенда)
 */
export async function signProtocol(chairman: string, decision_id: number | string, wif: string = private_key) {
  const { Classes } = await import('@coopenomics/sdk')
  const signer = new Classes.Document(wif)
  const seed = `robot-test-protocol:${chairman}:${decision_id}:${Date.now()}`
  const generated = {
    full_title: 'Протокол решения совета (тест)',
    html: '<p>Протокол решения совета для контрактного теста</p>',
    hash: createHash('sha256').update(seed).digest('hex'),
    meta: {
      title: 'Протокол решения совета (тест)',
      registry_id: 600,
      lang: 'ru',
      generator: 'boot-tests',
      version: '1.0.0',
      coopname: 'voskhod',
      username: chairman,
      created_at: new Date().toISOString(),
      block_num: 0,
      timezone: 'UTC',
      links: [],
      // строковый номер (например, для заявления) оставляем строкой: канонизация JCS не терпит NaN
      decision_id: Number.isFinite(Number(decision_id)) ? Number(decision_id) : String(decision_id),
    },
    binary: '',
  }
  const signed: any = await (signer as any).signDocument(generated, chairman, 1)
  // В цепь meta уходит строкой; подписи — как есть.
  return { ...signed, meta: JSON.stringify(signed.meta) }
}
