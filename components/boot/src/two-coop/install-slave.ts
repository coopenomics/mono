/**
 * Установка совета ведомого кооператива связки двух стендов (487-34).
 *
 * Повторяет установочный мастер председателя (pages/Union/InstallCooperative)
 * через GraphQL узла, без браузера:
 *   1. startInstall — ключ кооператива partner1 ложится в хранилище узла,
 *      узел публикует ключ входа в каталог partner1@catalog;
 *   2. installSystem — председатель и переменные кооператива, совет в цепи.
 *
 * Перед ним провайдер уже подключил узел (initSystem с данными организации,
 * стартовые AXON) — так же, как после поставки сервера. Скрипт повторяем:
 * установленная система второй раз не ставится.
 *
 * Вызывает components/boot/scripts/two_coop_slave.sh; адреса — из окружения.
 */
import process from 'node:process'
import { Client, Mutations, Queries } from '@coopenomics/sdk'
import { partner1Keys } from '../init/partner1-key'

const API_URL = required('SLAVE_API_URL')
const CHAIN_URL = required('SLAVE_CHAIN_URL')
const CHAIN_ID = required('SLAVE_CHAIN_ID')
const COOPNAME = process.env.SLAVE_COOPNAME || 'partner1'

// Председатель — те же данные, что у сценария docs-harness 08: на стенде
// приглашение на @example.com не доставляется, ссылку печатает скрипт.
const CHAIRMAN = {
  email: `chairman.${COOPNAME}@example.com`,
  first_name: 'Иван',
  last_name: 'Иванов',
  middle_name: 'Иванович',
  birthdate: '1990-01-01',
  phone: '+7 (901) 123-45-67',
  full_address: 'г. Москва, ул. Тестовая, д. 1, оф. 100',
}

function required(name: string): string {
  const value = process.env[name]
  if (!value)
    throw new Error(`${name} не задан`)
  return value
}

async function systemStatus(client: ReturnType<typeof Client.create>): Promise<string> {
  const { [Queries.System.GetSystemInfo.name]: info } = await client.Query(Queries.System.GetSystemInfo.query)
  return String(info.system_status)
}

async function main() {
  const client = Client.create({ api_url: API_URL, chain_url: CHAIN_URL, chain_id: CHAIN_ID })

  const before = await systemStatus(client)
  if (before === 'active') {
    console.log(`✓ ${COOPNAME}: система уже установлена`)
    return
  }
  if (before !== 'initialized')
    throw new Error(`${COOPNAME}: статус системы ${before}, ожидался initialized — провайдер подключил узел?`)

  const { privateKey } = await partner1Keys()
  const { [Mutations.System.StartInstall.name]: started } = await client.Mutation(
    Mutations.System.StartInstall.mutation,
    { variables: { data: { wif: privateKey } } },
  )

  await client.Mutation(Mutations.System.InstallSystem.mutation, {
    variables: {
      data: {
        install_code: started.install_code,
        soviet: [{ role: 'chairman', individual_data: CHAIRMAN }],
        vars: {
          coopname: COOPNAME,
          name: 'Партнёр-1',
          full_abbr: 'потребительский кооператив',
          full_abbr_genitive: 'потребительского кооператива',
          full_abbr_dative: 'потребительскому кооперативу',
          short_abbr: 'ПК',
          website: `https://${COOPNAME}.example.com`,
          confidential_link: `https://${COOPNAME}.example.com/privacy`,
          confidential_email: `privacy@${COOPNAME}.example.com`,
          contact_email: `contact@${COOPNAME}.example.com`,
          statute_link: `https://${COOPNAME}.example.com/statute`,
          passport_request: 'no',
        },
      },
    },
  })

  const after = await systemStatus(client)
  if (after !== 'active')
    throw new Error(`${COOPNAME}: после установки статус ${after}, ожидался active`)
  console.log(`✓ ${COOPNAME}: совет установлен, система активна`)
}

main().catch((e) => {
  console.error(`✗ установка ${COOPNAME}: ${e?.message ?? e}`)
  process.exit(1)
})
