import { beforeAll, describe, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import { Generator } from '../src'
import { PaymentMethod } from '../src/Models/PaymentMethod'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

beforeAll(async () => {
  await generator.connect(mongoUri)
})

describe('тестируем цифровой кошелёк', () => {
  it('генерация заявления на возврат паевого взноса (ReturnByMoney)', async () => {
    // Создаем платежный метод для тестирования
    const paymentMethod = new PaymentMethod(generator.storage, {
      username: 'ant',
      method_id: 'test-method-123',
      method_type: 'bank_transfer',
      is_default: true,
      data: {
        currency: 'RUB',
        bank_name: 'ПАО «Сбербанк»',
        account_number: '40817 810 6 3826 1231150',
        details: {
          bik: '44525225',
          corr: '30101 810 4 0000 0000225',
        },
      },
      deleted: false,
    })

    // Сохраняем платежный метод
    await paymentMethod.save()

    await testDocumentGeneration({
      registry_id: Cooperative.Registry.ReturnByMoney.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      method_id: 'test-method-123', // ID платежного метода
      quantity: '50 000',
      currency: 'RUB',
      payment_hash: 'test-payment-hash-123', // Хеш платежа для связи с withdraw
    })
  })

  it('генерация решения о возврате паевого взноса (ReturnByMoneyDecision)', async () => {
    await testDocumentGeneration({
      registry_id: Cooperative.Registry.ReturnByMoneyDecision.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      decision_id: 9001,
      payment_hash: 'abc123def456hash789',
      quantity: '50000',
      currency: 'руб.',
    })
  })
})
