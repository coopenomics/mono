import config, { SYMBOL } from '../configs'
import Blockchain from '../blockchain'
import { generateRandomSHA256 } from '../utils/randomHash'
import { signProgramAgreement } from './sign-program-agreement'
import { fakeDocument } from '../tests/shared/fakeDocument'
import { walletDraftId, walletProgramId } from '../tests/capital/consts'

export interface SubnetCoopOptions {
  coopname: string
  /** Публичный ключ кооператива из ГЛАВНОЙ цепи: аккаунт в подсети получает
   * его после регистрации, чтобы ключ председателя работал в обеих цепях.
   * Не задан — аккаунт остаётся на стандартном ключе сети (дев-упрощение). */
  publicKey?: string
  /** Домен кооператива — уходит в params.announce (провайдер читает его как
   * доменное имя, см. provider CLAUDE.md §16). */
  announce?: string
  description?: string
}

/**
 * Epic 29 (провайдер, тип запуска new_subnet): первичная регистрация
 * кооператива-клиента в СВЕЖЕЙ подсети, только что поднятой с генезиса и
 * забученной `boot:remote` (в цепи уже есть кооператив-оператор voskhod).
 *
 * Упрощённый флоу по образцу installExtraData (без решения совета — авто-
 * активация оператором) — все подписи стандартным ключом сети, которым в
 * дев-подсети владеют и системные аккаунты, и voskhod:
 *   createAccount → reguser(organization) → regcoop → stcoopstatus(active)
 *   → wallet::signagree (без членства в ЦПП Кошелька любой transfer падает
 *   ассертом is_can_transfer) → стартовые AXON + powerup → changeKey на ключ
 *   из главной цепи (если передан).
 *
 * Полноценный путь с документами и решением совета — хаб-оракул (Epic 24);
 * эта команда — его дев-скаффолд для контура провайдера.
 *
 * Идемпотентность: существующий аккаунт кооператива — признак выполненной
 * регистрации, выходим без транзакций.
 */
export async function registerCoopInSubnet(opts: SubnetCoopOptions) {
  const { coopname } = opts
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  // Гейт: аккаунт уже есть → регистрация выполнена ранее.
  try {
    await blockchain.api.rpc.get_account(coopname)
    console.log(`✓ Аккаунт ${coopname} уже существует в подсети — пропускаем регистрацию`)
    return
  }
  catch {
    // аккаунта нет — регистрируем
  }

  console.log(`\n=== Регистрация кооператива ${coopname} в подсети ===`)

  // Аккаунт создаётся на стандартном ключе сети: им же boot подписывает
  // regcoop от имени кооператива. Ключ из главной цепи ставится последним
  // шагом через registrator::changekey.
  await blockchain.createAccount({
    coopname: config.provider,
    referer: '',
    username: coopname,
    public_key: config.default_public_key,
    meta: '',
  })

  const registration_hash = generateRandomSHA256()
  await blockchain.registerUser({
    coopname: config.provider,
    braname: '',
    username: coopname,
    type: 'organization',
    statement: {
      hash: registration_hash,
      signatures: [],
      meta: '{}',
      version: '1.0.0',
      doc_hash: registration_hash,
      meta_hash: registration_hash,
    } as any,
    registration_hash,
  })

  await blockchain.registerCooperative({
    username: coopname,
    coopname,
    params: {
      is_cooperative: true,
      coop_type: 'conscoop',
      announce: opts.announce ?? '',
      description: opts.description ?? `Кооператив ${coopname} (подсеть)`,
      initial: `100.0000 ${config.token.govern_symbol}`,
      minimum: `300.0000 ${config.token.govern_symbol}`,
      org_initial: `1000.0000 ${config.token.govern_symbol}`,
      org_minimum: `3000.0000 ${config.token.govern_symbol}`,
    },
    document: {
      hash: registration_hash,
      signatures: [],
      meta: '{}',
      version: '1.0.0',
      doc_hash: registration_hash,
      meta_hash: registration_hash,
    } as any,
  })

  await blockchain.preInit({
    coopname,
    username: config.provider,
    status: 'active',
  })

  // Членство в ЦПП Кошелька оператора подсети: без записи в
  // wallet::users[voskhod].programs[coopname] любой transfer кооперативу
  // падает ассертом eosio.token::is_can_transfer.
  console.log('Подписываем wallet-соглашение (членство в ЦПП Кошелька подсети)')
  await signProgramAgreement(blockchain, config.provider, coopname, walletProgramId, walletDraftId, fakeDocument)

  console.log('Стартовые токены и ресурсы')
  await blockchain.transfer({
    from: 'eosio',
    to: coopname,
    quantity: `100.0000 ${SYMBOL}`,
    memo: 'стартовые средства подсети',
  })
  await blockchain.powerup({
    payer: 'eosio',
    receiver: coopname,
    days: config.powerup.days,
    payment: `100.0000 ${config.token.symbol}`,
    transfer: true,
  })

  // Ключ из главной цепи — последним шагом: дальше кооперативом управляет
  // его председатель, как в главной цепи.
  if (opts.publicKey && opts.publicKey !== config.default_public_key) {
    console.log(`Устанавливаем ключ кооператива из главной цепи (${opts.publicKey.slice(0, 12)}…)`)
    await blockchain.changeKey({
      coopname: config.provider,
      changer: config.provider,
      username: coopname,
      public_key: opts.publicKey,
    })
  }
  else {
    console.log('⚠ Ключ из главной цепи не передан — аккаунт остаётся на стандартном ключе сети')
  }

  console.log(`=== Кооператив ${coopname} зарегистрирован и активирован в подсети ===\n`)
}
