/**
 * Регенерация ключей для пайщиков ivanpetrov, ekaterina.
 * Генерирует свежий keypair, делает registrator::changekey от имени кооператива,
 * пишет новый wif/publicKey в фикстуры docs-harness/state/participants/<name>.json.
 *
 * Используется после reboot, когда on-chain аккаунты остались, а WIF потерян
 * (фикстуры в .gitignore — не сохраняются между сессиями).
 */
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import ecc from 'eosjs-ecc'
import { RegistratorContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'

const log = (...a: unknown[]) => console.error('[rotate-keys]', ...a)

const COOPNAME = 'voskhod'
const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = path.resolve(here, '../../../docs-harness/state/participants')

const PARTICIPANTS = ['ivanpetrov', 'ekaterina']

async function rotate(blockchain: Blockchain, username: string) {
  const wif = await ecc.randomKey()
  const publicKey = ecc.privateToPublic(wif)
  log(`${username}: новый ключ pub=${publicKey}`)

  await blockchain.api.transact({
    actions: [{
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.ChangeKey.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username,
        public_key: publicKey,
        changer: COOPNAME,
      } as RegistratorContract.Actions.ChangeKey.IChangeKey,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
  log(`${username}: registrator::changekey OK`)

  const file = path.join(FIXTURE_DIR, `${username}.json`)
  const prev = JSON.parse(fs.readFileSync(file, 'utf8'))
  const next = {
    ...prev,
    wif,
    publicKey,
  }
  fs.writeFileSync(file, JSON.stringify(next))
  log(`${username}: фикстура обновлена ${file}`)
}

async function main() {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  for (const u of PARTICIPANTS) {
    await rotate(blockchain, u)
  }
  log('готово')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
