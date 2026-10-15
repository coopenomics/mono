/**
 * Фаза 08 — выключение робота совета перед сценариями списания.
 *
 * Робот совета (расширение «robot») сам голосует и утверждает типовые решения,
 * в том числе списание скоропорта: проект уходит с повестки за секунду. Сценарий
 * writeoff-authorize документирует ручной путь — голоса членов совета и подпись
 * председателя, — и с включённым роботом снять его нельзя.
 *
 * Фазу вызывает сам сценарий writeoff-submit, а writeoff-authorize после своих
 * кадров включает робота обратно фазой 08-robot-on: остальным сценариям сюиты
 * (приёмка, выдача, возврат) решения совета нужны автоматом. Поэтому обе фазы
 * не входят в `all` и `--up-to` и не заявляются в meta.prepare — подготовка
 * сюиты прогоняет заявленные фазы разом до первого сценария.
 *
 * Идемпотентны: робот уже в нужном состоянии либо не установлен — no-op.
 */
import { Client, Mutations, Queries } from '@coopenomics/sdk'
import { loginChairman } from '../../lib/chairman-login'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-marketplace:08]', ...a)

const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'
const EXTENSION = 'robot'

async function setRobot(enabled: boolean): Promise<void> {
  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан — председателя нечем логинить')

  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()
  const info = await blockchain.getInfo()

  const client = Client.create({
    api_url: process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql',
    chain_url: `${config.network.protocol}://${config.network.host}${config.network.port}`,
    chain_id: info.chain_id,
    wif,
    username: CHAIRMAN,
  })
  await loginChairman(client, CHAIRMAN_EMAIL, wif)


  const listed = await client.Query(Queries.Extensions.GetExtensions.query, {
    variables: { data: { name: EXTENSION } },
  } as never) as never as Record<string, Array<{ name: string, enabled: boolean, config: Record<string, unknown> }>>
  const ext = (listed[Queries.Extensions.GetExtensions.name] ?? []).find(e => e.name === EXTENSION)
  if (!ext || ext.enabled === enabled) {
    log(`робот совета не установлен либо уже ${enabled ? 'включён' : 'выключен'} — пропуск`)
    return
  }

  await client.Mutation(Mutations.Extensions.UpdateExtension.mutation, {
    variables: { data: { name: EXTENSION, enabled, config: ext.config } },
  } as never)
  log(enabled ? 'робот совета включён' : 'робот совета выключен: решения совета принимаются вручную')
}

export const phase08off = (): Promise<void> => setRobot(false)
export const phase08on = (): Promise<void> => setRobot(true)
