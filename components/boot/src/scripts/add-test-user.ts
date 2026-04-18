/**
 * Одноразовый скрипт: добавляет тестового пайщика через registrator::adduser,
 * чтобы parser уловил live ledger2-дельты и controller получил их в
 * blockchain_deltas (для проверки ProcessRegistryService end-to-end).
 *
 * Запуск: pnpm run cli add-test-user <username>
 */
import Blockchain from '../blockchain'
import { generateRandomSHA256 } from '../utils/randomHash'
import config from '../configs'
import { RegistratorContract } from 'cooptypes'

export async function addTestUser(username: string) {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const registration_hash = generateRandomSHA256()
  console.log(`\nДобавляем пайщика ${username} с registration_hash=${registration_hash}`)

  const data: RegistratorContract.Actions.AddUser.IAddUser = {
    coopname: 'voskhod',
    referer: '',
    username,
    type: 'individual',
    created_at: '2025-01-15T10:00:00',
    initial: '100.0000 RUB',
    minimum: '200.0000 RUB',
    spread_initial: true,
    meta: 'Тестовый пайщик для проверки ProcessRegistry',
    registration_hash,
  }

  await blockchain.addUser(data)

  console.log(`\nУчастник ${username} добавлен. process_hash=${registration_hash}`)
  console.log(`Проверить ledger2: cleos get table ledger2 voskhod wjournal`)
  console.log(`Проверить GraphQL: query { process(hash: "${registration_hash}", coopname: "voskhod") { ... } }`)
}
