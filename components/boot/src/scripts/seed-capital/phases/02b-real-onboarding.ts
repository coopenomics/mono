/**
 * Фаза 02b — РЕАЛЬНОЕ проведение адаптации через совет (зарезервировано на будущее).
 *
 * НЕ ПОДКЛЮЧЕНА к диспетчеру seed-capital по умолчанию. Используется только если нужно
 * задокументировать сам процесс адаптации в UI (председатель кликает «Объявить собрание
 * совета», совет голосует, протокол фиксируется). Для большинства harness-сценариев,
 * которым достаточно «просто добраться до Мастерской», работает phase 02-extension-config —
 * она использует тот же dev-shortcut, что и `bootExtra()`: проставляет в postgres-конфиге
 * extensions.capital все *_done=true, и UI скипает онбординг.
 *
 * Эта фаза эмулирует UI-флоу через SDK:
 *   1) Председатель логинится в controller через SDK.
 *   2) Для каждого шага:
 *      a) Mutations.Documents.GenerateDocument — фабрика сгенерит положение/оферту;
 *      b) Mutations.Capital.CompleteOnboardingStep — controller сам пушит decision
 *         на цепочку и сохраняет его hash в onboarding state;
 *      c) находим decision по hash в таблице soviet.decisions;
 *      d) три члена совета (`petr`, `anna`, `mikhail`) подписывают и пушат
 *         soviet::votefor (порог консенсуса 50% от 5 = нужно ≥3 голосов);
 *      e) председатель `ant` пушит soviet::authorize + soviet::exec.
 *
 * ЗАМЕЧАНИЕ. На момент создания этой фазы был обнаружен блокер: controller хранит
 * onboarding state в postgres-таблице `extensions` (запись с `name='capital'`).
 * Если этой записи нет — `Mutations.Capital.CompleteOnboardingStep` падает с
 * «Конфигурация расширения capital не найдена». В dev-конфигурации запись создаётся
 * через `initExtensionsInPostgres()` СРАЗУ с `*_done=true`, поэтому реальный путь
 * через совет в этой среде не запускается. Чтобы оживить эту фазу, нужно сначала
 * вставить пустой config (без done-флагов), потом гонять её.
 */
import { Client, Mutations, Queries } from '@coopenomics/sdk'
import { Cooperative, SovietContract } from 'cooptypes'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:02b]', ...a)

// FreeDecision — общий протокол решения совета (registry_id=600). Используется
// для authorize/exec любого решения как «обёртка» — председатель подписывает
// HTML-протокол, его hash попадает в decision как `final_document`.
const FREE_DECISION_REGISTRY_ID = Cooperative.Registry.FreeDecision.registry_id

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'

// 3 голоса достаточно (5 членов × 50% = >2.5). Председатель не голосует:
// в реальной системе он только authorize/exec.
const VOTING_MEMBERS = ['petr', 'anna', 'mikhail']

// Источник: components/desktop/extensions/capital/features/Onboarding/model/composable.ts
// Если меняется там — синхронизировать здесь.
interface IStep {
  id: 'generator_program_template' | 'generation_contract_template' | 'blagorost_program' | 'generator_offer_template' | 'blagorost_offer_template'
  registry_id: number
  doneFlag: string
  hashFlag: string
  title: string
  question: string
}

const STEPS: IStep[] = [
  {
    id: 'generator_program_template',
    registry_id: 994,
    doneFlag: 'generator_program_template_done',
    hashFlag: 'onboarding_generator_program_template_hash',
    title: 'Положение о целевой потребительской программе "ГЕНЕРАТОР"',
    question: 'О утверждении Положения о целевой потребительской программе «ГЕНЕРАТОР»',
  },
  {
    id: 'generation_contract_template',
    registry_id: 997,
    doneFlag: 'generation_contract_template_done',
    hashFlag: 'onboarding_generation_contract_template_hash',
    title: 'Шаблон договора участия в хозяйственной деятельности',
    question: 'О утверждении шаблона договора участия в хозяйственной деятельности',
  },
  {
    id: 'blagorost_program',
    registry_id: 998,
    doneFlag: 'blagorost_provision_done',
    hashFlag: 'onboarding_blagorost_provision_hash',
    title: 'Положение о ЦПП «БЛАГОРОСТ»',
    question: 'О утверждении Положения о целевой потребительской программе «БЛАГОРОСТ»',
  },
  {
    id: 'generator_offer_template',
    registry_id: 995,
    doneFlag: 'generator_offer_template_done',
    hashFlag: 'onboarding_generator_offer_template_hash',
    title: 'Шаблон пользовательского соглашения (оферты) по участию в целевой потребительской программе "ГЕНЕРАТОР"',
    question: 'О утверждении шаблона пользовательского соглашения (оферты) по участию в целевой потребительской программе "ГЕНЕРАТОР"',
  },
  {
    id: 'blagorost_offer_template',
    registry_id: 999,
    doneFlag: 'blagorost_offer_template_done',
    hashFlag: 'onboarding_blagorost_offer_template_hash',
    title: 'Пользовательское соглашение (оферта) по ЦПП «БЛАГОРОСТ»',
    question: 'О утверждении пользовательского соглашения (оферты) по присоединению к ЦПП «БЛАГОРОСТ»',
  },
]

async function getDecisionByHash(
  blockchain: Blockchain,
  decisionHash: string,
): Promise<{ id: number, approved: boolean, project_id: string } | null> {
  // Решений в проекте не больше нескольких десятков; читаем последние 1000 и ищем по hash.
  const rows = await blockchain.getTableRows(
    SovietContract.contractName.production,
    COOPNAME,
    'decisions',
    1000,
  )
  // Цепочка возвращает hash в lowercase, controller — UPPERCASE; сравниваем case-insensitive.
  const target = decisionHash.toLowerCase()
  const found = rows.find((r: { hash: string }) => (r.hash ?? '').toLowerCase() === target) as
    | { id: number; approved: boolean; meta?: string }
    | undefined
  if (!found) return null
  // FreeDecision-протокол требует project_id, который controller кладёт в decision.meta.
  let projectId = ''
  try {
    const meta = JSON.parse(found.meta ?? '{}') as { project_id?: string }
    projectId = meta.project_id ?? ''
  } catch {}
  return { id: Number(found.id), approved: Boolean(found.approved), project_id: projectId }
}

export async function phase02b(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  // Берём chain_id из самой цепочки — не хардкодим.
  const info = await blockchain.getInfo()
  const chainId = info.chain_id
  const chainUrl = `${config.network.protocol}://${config.network.host}${config.network.port}`
  const apiUrl = process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql'

  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан в env — без него seed-capital:02 не залогинит председателя в controller')

  // SDK-клиент под председателем — для GenerateDocument + CompleteOnboardingStep.
  const client = Client.create({
    api_url: apiUrl,
    chain_url: chainUrl,
    chain_id: chainId,
    wif,
    username: CHAIRMAN,
  })
  log(`логин председателя ${CHAIRMAN_EMAIL} в controller (${apiUrl})...`)
  await client.login(CHAIRMAN_EMAIL, wif)

  // Все 5 членов совета используют один общий ключ (см. boot/src/init/infra.ts:
  // changekey раздаёт каждому config.default_public_key). Vote SDK-класса подписывает
  // голос за любого username — он уже инициализирован в Client.

  for (const step of STEPS) {
    // 1. Прочитать состояние онбординга (для идемпотентности).
    const stateBefore = await client.Query(Queries.Capital.GetOnboardingState.query) as Record<string, unknown>
    const onboardingBefore = stateBefore[Queries.Capital.GetOnboardingState.name] as Record<string, unknown>

    if (onboardingBefore?.[step.doneFlag]) {
      log(`[${step.id}] уже принято — пропуск`)
      continue
    }

    // 2. Сгенерировать фабричный документ (положение или оферта).
    log(`[${step.id}] фабрика documentRegistry=${step.registry_id}`)
    const docResp = await client.Mutation(
      Mutations.Documents.GenerateDocument.mutation,
      {
        variables: {
          input: {
            data: {
              coopname: COOPNAME,
              username: CHAIRMAN,
              registry_id: step.registry_id,
            },
          },
        } as Mutations.Documents.GenerateDocument.IInput,
      },
    ) as Record<string, { hash: string, html: string, full_title: string }>
    const generatedDoc = docResp[Mutations.Documents.GenerateDocument.name]

    // 3. Завершить шаг адаптации — controller сам propose-ит решение совета на цепочке.
    log(`[${step.id}] CompleteOnboardingStep`)
    const completeResp = await client.Mutation(
      Mutations.Capital.CompleteOnboardingStep.mutation,
      {
        variables: {
          data: {
            step: step.id,
            title: step.title,
            question: step.question,
            decision: generatedDoc.html,
          },
        } as Mutations.Capital.CompleteOnboardingStep.IInput,
      },
    ) as Record<string, Record<string, unknown>>
    const newState = completeResp[Mutations.Capital.CompleteOnboardingStep.name]

    const decisionHash = newState?.[step.hashFlag] as string | undefined
    if (!decisionHash) {
      throw new Error(`[${step.id}] CompleteOnboardingStep вернул state без ${step.hashFlag} — controller не создал решение?`)
    }

    // 4. Найти decision_id по hash в таблице soviet.decisions.
    let decision = await getDecisionByHash(blockchain, decisionHash)
    // На холодной системе индексация ноды иногда отстаёт на 1-2 блока — короткий ретрай.
    for (let i = 0; !decision && i < 5; i++) {
      await new Promise(r => setTimeout(r, 1000))
      decision = await getDecisionByHash(blockchain, decisionHash)
    }
    if (!decision) throw new Error(`[${step.id}] не нашёл decision с hash=${decisionHash} в таблице soviet.decisions`)
    log(`[${step.id}] decision_id=${decision.id}, hash=${decisionHash.slice(0, 12)}…`)

    // 5. Голосование: 3 члена совета. client.Vote.voteFor подписывает голос
    // общим WIF (Client.login его проставил в Vote-классе).
    for (const username of VOTING_MEMBERS) {
      const voteData = await client.Vote.voteFor(COOPNAME, username, decision.id)
      log(`[${step.id}] votefor ${username}`)
      await blockchain.api.transact(
        {
          actions: [
            {
              account: SovietContract.contractName.production,
              name: SovietContract.Actions.Decisions.VoteFor.actionName,
              authorization: [{ actor: username, permission: 'active' }],
              data: voteData,
            },
          ],
        },
        { blocksBehind: 3, expireSeconds: 30 },
      )
    }

    // 6. Authorize: председатель генерирует и подписывает РЕАЛЬНЫЙ протокол
    //    решения совета (FreeDecision, registry_id=600). Для генерации
    //    нужны decision_id + project_id (из meta решения). Никаких fakeDocument —
    //    иначе controller'ные verify-утилиты падают на «документ с хешем X не
    //    найден» при последующих flow.
    //
    //    Factory.getDecision читает votefor-actions через simple-explorer-api
    //    (parser-индекс). После votefor parser индексирует ~1-2 блока
    //    (≈700ms-2s). Без паузы получаем «Голоса за решение не найдены» —
    //    ждём с retry до 10s.
    let protocolDoc: { hash: string; doc_hash: string; meta_hash: string; meta: unknown; html: string; binary?: string; full_title?: string } | null = null
    let lastErr: unknown = null
    for (let attempt = 1; attempt <= 6; attempt++) {
      await new Promise(r => setTimeout(r, attempt === 1 ? 1500 : 2000))
      log(`[${step.id}] генерирую протокол (FreeDecision, decision_id=${decision.id}) attempt=${attempt}`)
      try {
        const protocolGen = await client.Mutation(
          Mutations.Documents.GenerateDocument.mutation,
          {
            variables: {
              input: {
                data: {
                  coopname: COOPNAME,
                  username: CHAIRMAN,
                  registry_id: FREE_DECISION_REGISTRY_ID,
                  decision_id: decision.id,
                  project_id: decision.project_id,
                  lang: 'ru',
                },
              },
            } as Mutations.Documents.GenerateDocument.IInput,
          },
        ) as Record<string, { hash: string; doc_hash: string; meta_hash: string; meta: unknown; html: string; binary?: string; full_title?: string }>
        protocolDoc = protocolGen[Mutations.Documents.GenerateDocument.name]
        break
      } catch (e) {
        lastErr = e
        log(`[${step.id}] generate FreeDecision failed (parser ещё индексирует votes?): retry ${attempt}/6`)
      }
    }
    if (!protocolDoc) throw lastErr ?? new Error(`[${step.id}] не удалось сгенерировать FreeDecision протокол`)

    log(`[${step.id}] подписываю протокол hash=${protocolDoc.hash.slice(0, 12)}...`)
    const signedRaw = await client.Document.signDocument(
      protocolDoc as Parameters<typeof client.Document.signDocument>[0],
      CHAIRMAN, // signer eosio name; без него signatures[].signer=undefined и
                // soviet::authorize валится на «Expected string containing name».
    )
    // eosjs ожидает meta как string; signDocument возвращает meta как object —
    // stringify, как делает desktop AuthorizeAndExecDecision.
    const signedProtocol = {
      ...signedRaw,
      meta: typeof signedRaw.meta === 'string'
        ? signedRaw.meta
        : JSON.stringify(signedRaw.meta ?? {}),
    }

    // Authorize + Exec в одной транзакции (как делает desktop AuthorizeAndExecDecision).
    log(`[${step.id}] authorize + exec под ${CHAIRMAN}`)
    await blockchain.api.transact(
      {
        actions: [
          {
            account: SovietContract.contractName.production,
            name: SovietContract.Actions.Decisions.Authorize.actionName,
            authorization: [{ actor: CHAIRMAN, permission: 'active' }],
            data: {
              coopname: COOPNAME,
              chairman: CHAIRMAN,
              decision_id: decision.id,
              document: signedProtocol,
            },
          },
          {
            account: SovietContract.contractName.production,
            name: SovietContract.Actions.Decisions.Exec.actionName,
            authorization: [{ actor: CHAIRMAN, permission: 'active' }],
            data: {
              executer: CHAIRMAN,
              coopname: COOPNAME,
              decision_id: decision.id,
            },
          },
        ],
      },
      { blocksBehind: 3, expireSeconds: 30 },
    )

    log(`[${step.id}] ✓ принят`)
  }

  log('фаза 02b завершена — реальный онбординг через совет проведён')
}
