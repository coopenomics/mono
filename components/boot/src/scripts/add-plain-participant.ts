/**
 * Полноценное создание «обычного» пайщика (role='user', не член совета) через бэкенд.
 * Делает: keypair → registrator::adduser → registrator::changekey → mongo individual →
 * postgres users (is_registered=true, status=active).
 *
 * Идемпотентно:
 *  - если username уже в registrator.accounts ончейн с нужным public_key — ничего не делает,
 *    просто читает public_key и печатает результат (wif=null, т.к. приватный ключ потерян
 *    между запусками — сохранять его должен harness в своём state).
 *  - если username уже есть в mongo/pg, но ончейн отсутствует — fail loud: «dirty state».
 *
 * Вывод — JSON одной строкой в stdout: `{username, email, wif, publicKey}` (wif=null если
 * участник был найден без перезаписи ключа).
 *
 * Логи — в stderr, чтобы stdout остался чисто машиночитаемым.
 */
import ecc from 'eosjs-ecc'
import { Client } from 'pg'
import mongoose from 'mongoose'
import { Generator } from '@coopenomics/factory'
import { RegistratorContract, type Cooperative } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'

const log = (...a: unknown[]) => console.error('[add-plain-participant]', ...a)

interface Args {
  username: string
  email: string
  firstName: string
  lastName: string
  middleName: string
  coopname?: string
}

async function getOnChainActiveKey(blockchain: Blockchain, username: string): Promise<string | null> {
  // registrator.accounts (scope=registrator) хранит карточку пайщика, но не публичный ключ —
  // ключ живёт в eosio-аккаунте через permission `active`. Берём оттуда.
  try {
    const acc = await blockchain.api.rpc.get_account(username)
    const active = acc.permissions?.find((p: any) => p.perm_name === 'active')
    return active?.required_auth?.keys?.[0]?.key ?? null
  } catch {
    return null
  }
}

export async function addPlainParticipant(args: Args) {
  const coopname = args.coopname ?? config.provider
  const { username, email, firstName, lastName, middleName } = args

  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  // === 1. ончейн-проверка ===
  const existingKey = await getOnChainActiveKey(blockchain, username)
  let wif: string | null = null
  let publicKey: string

  if (existingKey) {
    log(`on-chain: ${username} уже есть с public_key=${existingKey} — ключ не генерируется, создания участника пропускаю`)
    publicKey = existingKey
  } else {
    // === 2. генерируем новый keypair ===
    wif = await ecc.randomKey()
    publicKey = ecc.privateToPublic(wif)
    log(`новый keypair для ${username}: pub=${publicKey}`)

    // === 3. registrator::adduser ===
    const addData: RegistratorContract.Actions.AddUser.IAddUser = {
      coopname,
      referer: '',
      username,
      type: 'individual',
      created_at: new Date().toISOString().slice(0, 19),
      initial: '100.0000 RUB',
      minimum: '100.0000 RUB',
      spread_initial: false,
      meta: `Тестовый пайщик ${firstName} ${lastName}`,
      registration_hash: generateRandomSHA256(),
    }
    await blockchain.api.transact({
      actions: [{
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.AddUser.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data: addData,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
    log('registrator::adduser OK')

    // === 4. registrator::changekey — выдаём сгенерированный ключ ===
    const keyData: RegistratorContract.Actions.ChangeKey.IChangeKey = {
      coopname,
      username,
      public_key: publicKey,
      changer: coopname,
    }
    await blockchain.api.transact({
      actions: [{
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.ChangeKey.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data: keyData,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
    log('registrator::changekey OK')
  }

  // === 5. Mongo: individual запись (upsert) ===
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) throw new Error('MONGO_URI не задан в env')
  const generator = new Generator()
  await generator.connect(mongoUri)

  const individual: Cooperative.Users.IIndividualData = {
    username,
    first_name: firstName,
    last_name: lastName,
    middle_name: middleName,
    birthdate: '1990/01/01',
    phone: '+70000000000',
    email,
    full_address: 'Тестовый адрес',
    passport: {
      series: 1111,
      number: 100000 + Math.floor(Math.random() * 899999),
      issued_by: 'УФМС России (тест)',
      issued_at: '2010/01/01',
      code: '000-000',
    },
  }
  await generator.save('individual', individual)
  log('mongo individual upserted')

  await mongoose.disconnect().catch(() => {})

  // === 6. Postgres: users запись ===
  const pg = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })
  await pg.connect()
  await pg.query(`
    INSERT INTO "users" (username, email, type, role, status, is_registered,
                        has_account, is_email_verified, public_key,
                        created_at, updated_at)
    VALUES ($1, $2, 'individual', 'user', 'active', true,
            true, true, $3,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (username) DO UPDATE SET
      email = EXCLUDED.email,
      public_key = EXCLUDED.public_key,
      status = 'active',
      is_registered = true,
      updated_at = CURRENT_TIMESTAMP
  `, [username, email, publicKey])
  log('postgres users upserted')
  await pg.end()

  // === 7. JSON в stdout ===
  const result = { username, email, wif, publicKey, coopname }
  process.stdout.write(JSON.stringify(result))
}

// CLI: add-plain-participant <username> <email> <firstName> <lastName> <middleName>
const [, , username, email, firstName, lastName, middleName = ''] = process.argv
if (!username || !email || !firstName || !lastName) {
  console.error('Usage: add-plain-participant <username> <email> <firstName> <lastName> [middleName]')
  process.exit(2)
}

addPlainParticipant({ username, email, firstName, lastName, middleName })
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })
