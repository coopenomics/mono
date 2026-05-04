/**
 * Фаза 04 — регистрация председателя `ant` как Contributor в Капитале.
 *
 * UI после адаптации редиректит любой /capital/* на CapitalRegistrationPage,
 * пока у пользователя нет записи Contributor. Председатель `ant` к тому же
 * входит в `temporaryStubUsernames` (whitelist «ранних участников» в desktop)
 * — для него UI вообще показывает заглушку «обратитесь в поддержку», и
 * пройти регистрацию через клики невозможно.
 *
 * Whitelist проверяется ТОЛЬКО на UI; backend GraphQL мутация
 * `Mutations.Capital.CompleteCapitalRegistration` принимает запрос для любого
 * username. Программно создаём Contributor для ant — и при следующем входе
 * в UI его сразу пускают в Мастерскую.
 *
 * Эмуляция UI-флоу `signAndCompleteRegistration` из CapitalRegistrationPage.vue:
 *   1) Логин председателя в controller через SDK → Bearer-token.
 *   2) Mutations.Capital.GenerateCapitalRegistrationDocuments — controller
 *      возвращает пакет документов (storage_agreement обязательный +
 *      generation_contract / blagorost_agreement / generator_offer опциональные).
 *   3) Каждый документ подписывается ключом ant'а через Client.Document.signDocument().
 *   4) Mutations.Capital.CompleteCapitalRegistration — controller валидирует
 *      подписи, создаёт Contributor в БД и пушит on-chain `capital::regcontrib`.
 *
 * Идемпотентно: перед запуском проверяем через GraphQL, есть ли уже Contributor
 * для ant. Если да — фаза no-op.
 */
import { Client, Mutations } from '@coopenomics/sdk'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:04]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'

interface IGeneratedDoc {
  uuid?: string
  hash: string
  html: string
  meta: Record<string, unknown> | string
  binary?: string
  full_title?: string
}

interface IRegDocsBundle {
  generation_contract?: IGeneratedDoc
  storage_agreement: IGeneratedDoc
  blagorost_agreement?: IGeneratedDoc
  generator_offer?: IGeneratedDoc
}

export async function phase04(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const info = await blockchain.getInfo()
  const chainId = info.chain_id
  const chainUrl = `${config.network.protocol}://${config.network.host}${config.network.port}`
  const apiUrl = process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql'

  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан в env')

  const client = Client.create({
    api_url: apiUrl,
    chain_url: chainUrl,
    chain_id: chainId,
    wif,
    username: CHAIRMAN,
  })
  log(`логин ${CHAIRMAN_EMAIL} в controller (${apiUrl})...`)
  await client.login(CHAIRMAN_EMAIL, wif)

  // 1. Idempotency через попытку сгенерировать пакет: если Contributor уже зарегистрирован,
  // controller вернёт пустой bundle (без обязательного storage_agreement) или бросит ошибку.
  // GetContributor-query на эту проверку плохо подходит (поле username возвращается даже
  // для «черновика», созданного где-то ещё), поэтому надёжнее реакция самого Generate.
  log('GenerateCapitalRegistrationDocuments')
  let bundle: IRegDocsBundle | undefined
  try {
    const genResp = await client.Mutation(
      Mutations.Capital.GenerateCapitalRegistrationDocuments.mutation,
      {
        variables: {
          data: {
            coopname: COOPNAME,
            username: CHAIRMAN,
            lang: 'ru',
          },
        } as Mutations.Capital.GenerateCapitalRegistrationDocuments.IInput,
      },
    ) as Record<string, IRegDocsBundle>
    bundle = genResp[Mutations.Capital.GenerateCapitalRegistrationDocuments.name]
  } catch (e) {
    log(`Generate отказал — вероятно Contributor уже зарегистрирован: ${(e as Error).message ?? e}`)
    log('фаза 04 завершена (no-op)')
    return
  }
  if (!bundle?.storage_agreement) {
    log(`controller вернул пустой bundle — Contributor для ${CHAIRMAN} уже зарегистрирован, пропуск`)
    log('фаза 04 завершена (no-op)')
    return
  }
  log(`получены документы: generation_contract=${!!bundle.generation_contract}, storage_agreement=true, blagorost_agreement=${!!bundle.blagorost_agreement}, generator_offer=${!!bundle.generator_offer}`)

  // 3. Подписываем каждый документ ключом ant. Client.Document уже инициализирован
  // с WIF после Client.login, signDocument требует только сам документ + account.
  const signed: Record<string, unknown> = {}
  let sigId = 1
  for (const key of ['generation_contract', 'storage_agreement', 'blagorost_agreement', 'generator_offer'] as const) {
    const doc = bundle[key]
    if (!doc) continue
    log(`подписываю ${key} (id=${sigId})`)
    signed[key] = await client.Document.signDocument(
      doc as Parameters<typeof client.Document.signDocument>[0],
      CHAIRMAN,
      sigId++,
    )
  }

  // 4. Финализируем регистрацию. Controller внутри:
  //    - валидирует подписи и hash'и
  //    - создаёт запись Contributor в pg
  //    - пушит on-chain capital::regcontrib (от имени voskhod@active)
  log('CompleteCapitalRegistration')
  const data = {
    coopname: COOPNAME,
    username: CHAIRMAN,
    ...signed,
    // Минимальные значения формы — председатель не «исполнитель», но
    // controller требует наличие полей в payload.
    about: 'Председатель кооператива',
    rate_per_hour: '0',
    hours_per_day: 0,
  }
  await client.Mutation(
    Mutations.Capital.CompleteCapitalRegistration.mutation,
    {
      variables: { data } as Mutations.Capital.CompleteCapitalRegistration.IInput,
    },
  )

  log(`Contributor зарегистрирован: ${CHAIRMAN}`)
  log('фаза 04 завершена')
}
