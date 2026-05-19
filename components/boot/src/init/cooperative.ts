import type { Cooperative } from 'cooptypes'
import type { Keys } from '../types'
import config, { GOVERN_SYMBOL, SYMBOL } from '../configs'
import Blockchain from '../blockchain'
import { generateRandomSHA256 } from '../utils/randomHash'
import { processLastDecision } from '../tests/soviet/processLastDecision'

const test_hash
  = '157192b276da23cc84ab078fc8755c051c5f0430bf4802e55718221e6b76c777'
const test_sign
  = 'SIG_K1_KmKWPBC8dZGGDGhbKEoZEzPr3h5crRrR2uLdGRF5DJbeibY1MY1bZ9sPwHsgmPfiGFv9psfoCVsXFh9TekcLuvaeuxRKA8'
const test_pkey = 'EOS5JhMfxbsNebajHcTEK8yC9uNN9Dit9hEmzE8ri8yMhhzxrLg3J'
const test_meta = JSON.stringify({})

const document: Cooperative.Document.ISignedDocument2 = {
  hash: test_hash,
  signatures: [
    {
      id: 1,
      signed_hash: test_hash,
      public_key: test_pkey,
      signed_at: '2025-05-14T12:22:26',
      meta: test_meta,
      signer: 'cooperative1',
      signature: test_sign,
    },
  ],
  meta: test_meta,
  version: '1.0.0',
  doc_hash: test_hash,
  meta_hash: test_hash,
}

export class CooperativeClass {
  public blockchain: Blockchain

  constructor(blockchain: Blockchain) {
    this.blockchain = blockchain
  }

  async createPrograms(coopname: string) {
    await this.blockchain.createProgram({
      coopname,
      username: coopname,
      type: 'marketplace',
      title: 'КООПЛЕЙС',
      announce: '',
      description: '',
      preview: '',
      images: '',
      calculation_type: 'relative',
      fixed_membership_contribution: `${Number(0).toFixed(4)} ${GOVERN_SYMBOL}`,
      membership_percent_fee: 10000, // 10%
      meta: '',
      is_can_coop_spend_share_contributions: false,
    })

    await this.blockchain.createProgram({
      coopname,
      username: coopname,
      type: 'generator',
      title: 'Целевая потребительская программа "Генератор"',
      announce: '',
      description: '',
      preview: '',
      images: '',
      calculation_type: 'free',
      fixed_membership_contribution: `${Number(0).toFixed(4)} ${GOVERN_SYMBOL}`,
      membership_percent_fee: 0, // 10%
      meta: '',
      is_can_coop_spend_share_contributions: true,
    })

    await this.blockchain.createProgram({
      coopname,
      username: coopname,
      type: 'blagorost',
      title: 'Целевая потребительская программа "Благорост"',
      announce: '',
      description: '',
      preview: '',
      images: '',
      calculation_type: 'free',
      fixed_membership_contribution: `${Number(0).toFixed(4)} ${GOVERN_SYMBOL}`,
      membership_percent_fee: 0, // 10%
      meta: '',
      is_can_coop_spend_share_contributions: true,
    })
  }

  async createCooperative(username: string, keys?: Keys) {
    const account = await this.blockchain.generateKeypair(
      username,
      keys,
      'Аккаунт кооператива',
    )
    console.log('Регистрируем аккаунт')

    await this.blockchain.createAccount({
      coopname: config.provider,
      referer: '',
      username: account.username,
      public_key: account.publicKey,
      meta: '',
    })

    console.log('Регистрируем аккаунт как пользователя')
    const registration_hash = generateRandomSHA256()

    await this.blockchain.registerUser({
      coopname: config.provider,
      braname: '',
      username: account.username,
      type: 'organization',
      statement: document,
      registration_hash,
    })

    console.log('Отправляем заявление на вступление')

    await this.blockchain.ConfirmPayment({
      coopname: config.provider,
      income_hash: registration_hash,
    })

    await processLastDecision(this.blockchain, config.provider)
    // console.log('Голосуем по решению в провайдере')

    // await this.blockchain.votefor({
    //   version: '1.0.0',
    //   signed_at: '2025-05-14T12:22:26',
    //   signed_hash: test_hash,
    //   signature: test_sign,
    //   public_key: test_pkey,
    //   coopname: config.provider,
    //   username: config.provider_chairman,
    //   decision_id: 1,
    // })

    // console.log('Утверждаем решение в провайдере')

    // await this.blockchain.authorize({
    //   coopname: config.provider,
    //   chairman: config.provider_chairman,
    //   decision_id: 1,
    //   document,
    // })

    // console.log('Исполняем решение в провайдере')

    // await this.blockchain.exec({
    //   executer: config.provider_chairman,
    //   coopname: config.provider,
    //   decision_id: 1,
    // })

    console.log('Отправляем подписанное положение о ЦПП Кошелька оператору')

    await this.blockchain.sendAgreement({
      coopname: config.provider,
      administrator: config.provider,
      username: username!,
      agreement_type: 'wallet',
      document,
    })

    console.log('Переводим аккаунт в кооператив')

    await this.blockchain.registerCooperative({
      username: account.username,
      coopname: account.username,
      params: {
        is_cooperative: true,
        coop_type: 'conscoop',
        announce: 'voskhod-dev.coopenomics.world',
        description: 'Восход — тестовый кооператив-оператор (dev-стенд)',
        initial: `100.0000 ${config.token.govern_symbol}`,
        minimum: `300.0000 ${config.token.govern_symbol}`,
        org_initial: `1000.0000 ${config.token.govern_symbol}`,
        org_minimum: `3000.0000 ${config.token.govern_symbol}`,
      },
      document,
    })

    console.log('Переводим инициализационные токены')
    await this.blockchain.transfer({ from: 'eosio', to: account.username, quantity: `100.0000 ${SYMBOL}`, memo: '' })

    console.log(`Арендуем ресурсы кооперативу`)

    await this.blockchain.powerup({
      payer: 'eosio',
      receiver: username,
      days: config.powerup.days,
      payment: `100.0000 ${config.token.symbol}`,
      transfer: true,
    })
  }
}

export async function startCoop() {
  // инициализируем инстанс с ключами
  const blockchain = new Blockchain(config.network, config.private_keys)
  const cooperative = new CooperativeClass(blockchain)

  // await cooperative.createCooperative('cooperative1', {
  //   // eslint-disable-next-line node/prefer-global/process
  //   privateKey: process.env.EOSIO_PRV_KEY!,
  //   // eslint-disable-next-line node/prefer-global/process
  //   publicKey: process.env.EOSIO_PUB_KEY!,
  // })

  // await blockchain.preInit({
  //   coopname: 'cooperative1',
  //   username: config.provider,
  //   status: 'active',
  // })

  console.log('Кооператив предварительно подготовлен к установке совета.')
}
