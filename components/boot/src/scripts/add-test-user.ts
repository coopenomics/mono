/**
 * Одноразовый скрипт: добавляет тестового пайщика через registrator::adduser,
 * чтобы parser уловил live ledger2-actions и controller получил их в
 * blockchain_actions (для проверки ProcessRegistryService end-to-end).
 *
 * Epic 1 addendum удалил wjournal/journal из ledger2 (были в RAM). Phase A
 * ProcessRegistry теперь читает blockchain_actions — history восстанавливается
 * из action traces (apply + walletop + debit + credit).
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
  console.log(`Проверить on-chain:`)
  console.log(`  cleos get actions ledger2 -1 -5             # последние apply/walletop/debit/credit`)
  console.log(`  cleos get table ledger2 voskhod accounts2   # актуальные балансы счетов`)
  console.log(`  cleos get table ledger2 voskhod wallets2    # общекооперативные кошельки`)
  console.log(`  cleos get table registrator voskhod candidates2  # карточка кандидата`)
  console.log(`Проверить GraphQL: query { process(hash: "${registration_hash}", coopname: "voskhod") { process_type actions { action } delta_history { table primary_key } } }`)
}
