import { beforeAll, describe, expect, it } from 'vitest'
import { PrivateKey, generateKeyPair } from 'eosjs/dist/eosjs-key-conversions'
import { KeyType } from 'eosjs/dist/eosjs-numeric'
import { RegistratorContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomUsername } from '../utils/randomUsername'
import { generateRandomSHA256 } from '../utils/randomHash'

/**
 * Подпись пайщика под документом сделана ключом его аккаунта.
 *
 * Транзакции во все контракты отправляет кооператив своим ключом, а подписи
 * внутри документа до 17.09.2026 сверялись только с приложенным к ним же
 * открытым ключом. Значит любой ключ, поставленный рядом с чужим именем,
 * проходил как подпись этого человека: заявление о вступлении, выходе, акт
 * приёма результата — всё это можно было оформить за пайщика.
 *
 * Проверяется общий механизм (`verify_signer_keys_or_fail` в document_core),
 * одинаковый во всех контрактах; здесь он берётся на самом коротком пути —
 * заявлении о вступлении.
 */
const blockchain = new Blockchain(config.network, config.private_keys)

const COOP = 'voskhod'
const OWN_KEY = PrivateKey.fromString(process.env.EOSIO_PRV_KEY as string)

beforeAll(async () => {
  await blockchain.update_pass_instance()
}, 500_000)

function signedStatement(signer: string, key: PrivateKey) {
  const hash = generateRandomSHA256()
  return {
    hash,
    doc_hash: hash,
    meta_hash: hash,
    version: '1.0.0',
    meta: '{}',
    signatures: [
      {
        id: 1,
        signer,
        public_key: key.getPublicKey().toString(),
        // Подписывается уже готовый дайджест документа, второй аргумент выключает повторное хэширование.
        signature: key.sign(Buffer.from(hash, 'hex'), false).toString(),
        signed_hash: hash,
        signed_at: new Date().toISOString().slice(0, 19),
        meta: '{}',
      },
    ],
  }
}

async function createAccount(username: string, key: PrivateKey) {
  const data: RegistratorContract.Actions.CreateAccount.ICreateAccount = {
    coopname: COOP,
    referer: '',
    username,
    public_key: key.getPublicKey().toString(),
    meta: '{}',
  }
  return blockchain.api.transact({
    actions: [{
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.CreateAccount.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function regUser(username: string, statement: unknown) {
  return blockchain.api.transact({
    actions: [{
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.RegisterUser.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: {
        coopname: COOP,
        braname: '',
        username,
        type: 'individual',
        statement,
        registration_hash: generateRandomSHA256(),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

describe('подпись под документом принадлежит аккаунту подписанта', () => {
  it('заявление, подписанное чужим ключом, отклоняется', async () => {
    const username = generateRandomUsername()
    await createAccount(username, OWN_KEY)

    const foreign = generateKeyPair(KeyType.k1, { secureEnv: true }).privateKey
    await expect(regUser(username, signedStatement(username, foreign))).rejects.toThrow(
      /Public key does not belong to account/,
    )
  }, 120_000)

  it('заявление, подписанное ключом своего аккаунта, принимается', async () => {
    const username = generateRandomUsername()
    await createAccount(username, OWN_KEY)

    await expect(regUser(username, signedStatement(username, OWN_KEY))).resolves.toBeTruthy()
  }, 120_000)
})
