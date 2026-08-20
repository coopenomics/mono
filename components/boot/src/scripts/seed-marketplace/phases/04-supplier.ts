/**
 * Фаза 04 — допуск поставщика в реестр кооператива.
 *
 * Пайщик становится поставщиком не сам по себе: администратор либо одобряет
 * его заявку, либо добавляет напрямую (путь 2). Без записи в реестре роль
 * offerer не выдаётся, и весь стол поставщика отдаёт «Недостаточно прав
 * доступа» — сценарий создания предложения до формы не доходит.
 *
 * Допуск — не часть проверяемого экрана, поэтому живёт фазой. Сам путь
 * «заявка → одобрение председателем» документируется отдельным сценарием.
 *
 * Идемпотентна: повторное добавление отбивается сервером, и это не ошибка.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Client, Mutations } from '@coopenomics/sdk'
import { Generator } from '@coopenomics/factory'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const STATE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../docs-harness/state/participants',
)

const log = (...a: unknown[]) => console.error('[seed-marketplace:04]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'
const SUPPLIERS = ['ivanpetrov', 'sidorov'] // sidorov — фоновый поставщик витрины (фаза 06)

export async function phase04(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()
  const info = await blockchain.getInfo()

  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан — председателя нечем логинить')

  const client = Client.create({
    api_url: process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql',
    chain_url: `${config.network.protocol}://${config.network.host}${config.network.port}`,
    chain_id: info.chain_id,
    wif,
    username: CHAIRMAN,
  })
  await client.login(CHAIRMAN_EMAIL, wif)

  for (const member of SUPPLIERS) {
    try {
      await client.Mutation(Mutations.Marketplace.AddSupplier.mutation, {
        variables: { input: { member_account: member } },
      } as never)
      log(`${member} добавлен в реестр поставщиков`)
    }
    catch (e) {
      // Повторный прогон: запись уже есть — это штатный отказ, а не поломка.
      log(`${member}: ${(e as Error).message ?? 'уже в реестре'}`)
    }

    // Реквизиты для выплат. Без них форма предложения показывает блокирующее
    // предупреждение «Укажите реквизиты для выплат» и публикация закрыта:
    // выплаты по актам приёмки приходят поставщику на его счёт.
    const fixtureFile = path.join(STATE_DIR, `${member}.json`)
    if (!fs.existsSync(fixtureFile)) {
      log(`${member}: нет state-файла — реквизиты не настроены`)
      continue
    }
    const fixture = JSON.parse(fs.readFileSync(fixtureFile, 'utf8')) as { email: string, wif: string }

    const generator = new Generator()
    await generator.connect(process.env.MONGO_URI as string)
    const methodId = randomUUID()
    await generator.save('paymentMethod', {
      is_default: true,
      method_id: methodId,
      method_type: 'bank_transfer',
      username: member,
      data: {
        account_number: '40817810099910004312',
        currency: 'RUB',
        card_number: '',
        bank_name: 'ПАО Сбербанк',
        details: { bik: '044525225', corr: '30101810400000000225', kpp: '773643001' },
      },
    })
    await generator.close?.()

    const supplierClient = Client.create({
      api_url: process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql',
      chain_url: `${config.network.protocol}://${config.network.host}${config.network.port}`,
      chain_id: info.chain_id,
      wif: fixture.wif,
      username: member,
    })
    await supplierClient.login(fixture.email, fixture.wif)
    await supplierClient.Mutation(Mutations.Marketplace.SetSupplierPayoutMethod.mutation, {
      variables: { input: { method_id: methodId } },
    } as never)
    log(`${member}: реквизиты для выплат настроены`)
  }
}
