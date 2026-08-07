/**
 * Фаза 01 — L1: кооператив принимает ЦПП «Стол заказов».
 *
 * Зачем seed'ом, а не сценарием. Принятие ЦПП — решение Совета: председатель
 * выносит вопрос, три члена совета голосуют, председатель подписывает протокол
 * и исполняет решение. Пока это не сделано, у председателя нет ни одного
 * admin-права расширения, и ВСЕ остальные экраны Стола заказов отдают
 * «Недостаточно прав доступа». Ставить эту многоактовую процедуру в начало
 * каждого UI-прогона — значит проверять платформенный онбординг вместо Стола
 * заказов. Сам экран принятия ЦПП документируется отдельным сценарием.
 *
 * Механика повторяет seed-capital:02b (там же подробности про подводные камни):
 *   1) председатель логинится в controller через SDK;
 *   2) для каждого шага реестра онбординга:
 *      a) фабрика рендерит документ (Положение 1099 / шаблон оферты 1100);
 *      b) completeExtensionOnboardingStep — controller публикует проект
 *         решения совета и регистрирует tracking-rule;
 *      c) ищем decision по hash в таблице soviet.decisions;
 *      d) три члена совета пушат soviet::votefor (порог — больше половины
 *         из пяти, председатель не голосует);
 *      e) председатель генерирует и подписывает протокол (FreeDecision, 600),
 *         затем soviet::authorize + soviet::exec одной транзакцией.
 *   3) по ратификации последнего шага платформа сама рестартит расширение,
 *      выставляет coopAcceptance.accepted и регистрирует оферту.
 *
 * Идемпотентна: шаг с done=true пропускается.
 */
import { Client, Mutations, Queries } from '@coopenomics/sdk'
import { Cooperative, SovietContract } from 'cooptypes'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-marketplace:01]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'
const EXTENSION = 'market'

// Председатель не голосует: он выносит вопрос и исполняет решение.
// Пять членов совета, порог — больше половины, поэтому хватает трёх голосов.
const VOTING_MEMBERS = ['petr', 'anna', 'mikhail']

const FREE_DECISION_REGISTRY_ID = Cooperative.Registry.FreeDecision.registry_id

// registry_id документов шагов. Источник — desktop
// pages/Marketplace/OnboardingCoopAcceptCpp/model/composable.ts (STEP_REGISTRY):
// именно эти документы рендерит интерфейс. В комментарии бэкендового
// register-marketplace-onboarding-steps.ts указаны 1099/1100 — это устаревшая
// подпись, фабрики для 1099 не существует вовсе.
const STEP_DOCS: Record<string, { registry_id: number, title: string, question: string }> = {
  marketplace_provision: {
    registry_id: 1100,
    title: 'Положение о ЦПП «Стол заказов»',
    question: 'Об утверждении Положения о целевой потребительской программе «Стол заказов»',
  },
  marketplace_offer_template: {
    registry_id: 1101,
    title: 'Шаблон публичной оферты ЦПП «Стол заказов»',
    question: 'Об утверждении шаблона публичной оферты по присоединению пайщиков к ЦПП «Стол заказов»',
  },
}

interface IDecisionRow { id: number, approved: boolean, authorized: boolean, votesFor: string[], project_id: string }

async function getDecisionByHash(blockchain: Blockchain, decisionHash: string): Promise<IDecisionRow | null> {
  const rows = await blockchain.getTableRows(
    SovietContract.contractName.production,
    COOPNAME,
    'decisions',
    1000,
  )
  // Цепь отдаёт hash в lowercase, controller — в верхнем регистре.
  const target = decisionHash.toLowerCase()
  const found = rows.find((r: { hash: string }) => (r.hash ?? '').toLowerCase() === target) as
    | { id: number, approved: boolean, authorized: boolean, votes_for?: string[], meta?: string }
    | undefined
  if (!found) return null
  let projectId = ''
  try {
    const meta = JSON.parse(found.meta ?? '{}') as { project_id?: string }
    projectId = meta.project_id ?? ''
  }
  catch {}
  return {
    id: Number(found.id),
    approved: Boolean(found.approved),
    authorized: Boolean(found.authorized),
    votesFor: found.votes_for ?? [],
    project_id: projectId,
  }
}

export async function phase01(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const info = await blockchain.getInfo()
  const chainId = info.chain_id
  const chainUrl = `${config.network.protocol}://${config.network.host}${config.network.port}`
  const apiUrl = process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql'

  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан в env — председателя нечем логинить в controller')

  const client = Client.create({ api_url: apiUrl, chain_url: chainUrl, chain_id: chainId, wif, username: CHAIRMAN })
  log(`логин председателя ${CHAIRMAN_EMAIL} в controller (${apiUrl})`)
  await client.login(CHAIRMAN_EMAIL, wif)

  const readState = async () => {
    const resp = await client.Query(Queries.Onboarding.GetExtensionOnboardingState.query, {
      variables: { extension_name: EXTENSION },
    }) as Record<string, { steps: Array<{ step_key: string, done: boolean, hash: string | null }>, all_done: boolean }>
    return resp[Queries.Onboarding.GetExtensionOnboardingState.name]
  }

  const state = await readState()
  if (state.all_done) {
    log('ЦПП уже принята советом — пропуск')
    return
  }

  for (const step of state.steps) {
    if (step.done) {
      log(`[${step.step_key}] уже ратифицирован — пропуск`)
      continue
    }
    const doc = STEP_DOCS[step.step_key]
    if (!doc) throw new Error(`[${step.step_key}] нет описания документа шага в STEP_DOCS — реестр шагов изменился`)

    // Шаг мог быть опубликован прошлым прогоном и застрять до голосования:
    // повторная публикация упирается в уникальный индекс tracking-rule
    // («duplicate key»), поэтому берём уже созданное решение и идём к голосам.
    let decisionHash: string | undefined = step.hash ?? undefined
    if (decisionHash) {
      log(`[${step.step_key}] решение уже опубликовано (${decisionHash.slice(0, 12)}…) — сразу к голосованию`)
    }
    else {

    // 1. Фабричный документ шага.
    log(`[${step.step_key}] фабрика registry_id=${doc.registry_id}`)
    const docResp = await client.Mutation(Mutations.Documents.GenerateDocument.mutation, {
      variables: {
        input: { data: { coopname: COOPNAME, username: CHAIRMAN, registry_id: doc.registry_id } },
      } as Mutations.Documents.GenerateDocument.IInput,
    }) as Record<string, { hash: string, html: string, full_title: string }>
    const generated = docResp[Mutations.Documents.GenerateDocument.name]

    // 2. Публикация проекта решения совета.
    log(`[${step.step_key}] completeExtensionOnboardingStep`)
    const completed = await client.Mutation(Mutations.Onboarding.CompleteExtensionOnboardingStep.mutation, {
      variables: {
        data: {
          extension_name: EXTENSION,
          step_key: step.step_key,
          title: doc.title,
          question: doc.question,
          decision: generated.html,
        },
      } as Mutations.Onboarding.CompleteExtensionOnboardingStep.IInput,
    }) as Record<string, { steps: Array<{ step_key: string, hash: string | null }> }>

    const published = completed[Mutations.Onboarding.CompleteExtensionOnboardingStep.name]
    decisionHash = published.steps.find(s => s.step_key === step.step_key)?.hash ?? undefined
    if (!decisionHash) throw new Error(`[${step.step_key}] шаг опубликован без hash — решение совета не создано`)
    }

    // 3. Ищем решение в цепи (индексация ноды может отставать на пару блоков).
    let decision = await getDecisionByHash(blockchain, decisionHash)
    for (let i = 0; !decision && i < 6; i++) {
      await new Promise(r => setTimeout(r, 1000))
      decision = await getDecisionByHash(blockchain, decisionHash)
    }
    if (!decision) throw new Error(`[${step.step_key}] решение с hash=${decisionHash} не появилось в soviet.decisions`)
    log(`[${step.step_key}] decision_id=${decision.id}`)

    // 4. Голоса совета.
    for (const username of VOTING_MEMBERS) {
      // Голоса уже отданные повторить нельзя — контракт отбивает «Участник уже
      // голосовал». Прошлый прогон мог упасть после части голосов.
      if (decision.votesFor.includes(username)) {
        log(`[${step.step_key}] ${username} уже голосовал — пропуск`)
        continue
      }
      log(`[${step.step_key}] готовлю голос ${username}`)
      const voteData = await client.Vote.voteFor(COOPNAME, username, decision.id)
      await blockchain.api.transact({
        actions: [{
          account: SovietContract.contractName.production,
          name: SovietContract.Actions.Decisions.VoteFor.actionName,
          authorization: [{ actor: username, permission: 'active' }],
          data: voteData,
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
      log(`[${step.step_key}] голос ${username}`)
    }

    // 5. Протокол решения. Фабрика читает голоса через индекс парсера, который
    //    отстаёт на 1-2 блока после votefor — отсюда retry, а не одна попытка.
    let protocol: Record<string, unknown> | null = null
    let lastErr: unknown = null
    for (let attempt = 1; attempt <= 6; attempt++) {
      await new Promise(r => setTimeout(r, attempt === 1 ? 1500 : 2000))
      try {
        const gen = await client.Mutation(Mutations.Documents.GenerateDocument.mutation, {
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
        }) as Record<string, Record<string, unknown>>
        protocol = gen[Mutations.Documents.GenerateDocument.name]
        break
      }
      catch (e) {
        lastErr = e
        log(`[${step.step_key}] протокол ещё не собирается (парсер индексирует голоса), попытка ${attempt}/6`)
      }
    }
    if (!protocol) throw lastErr ?? new Error(`[${step.step_key}] не удалось сгенерировать протокол решения`)

    // 6. Подпись протокола и исполнение решения.
    const signedRaw = await client.Document.signDocument(
      protocol as Parameters<typeof client.Document.signDocument>[0],
      CHAIRMAN, // без явного подписанта signatures[].signer=undefined и authorize падает
    )
    const signed = {
      ...signedRaw,
      meta: typeof signedRaw.meta === 'string' ? signedRaw.meta : JSON.stringify(signedRaw.meta ?? {}),
    }

    log(`[${step.step_key}] authorize + exec`)
    await blockchain.api.transact({
      actions: [
        {
          account: SovietContract.contractName.production,
          name: SovietContract.Actions.Decisions.Authorize.actionName,
          // Авторизует КООПЕРАТИВ (в проде действие идёт через бэкенд ключом
          // кооператива), см. soviet/src/decision/authorize.cpp: require_auth(coopname).
          // Согласие председателя подтверждается его подписью на протоколе.
          authorization: [{ actor: COOPNAME, permission: 'active' }],
          data: { coopname: COOPNAME, chairman: CHAIRMAN, decision_id: decision.id, document: signed },
        },
        {
          account: SovietContract.contractName.production,
          name: SovietContract.Actions.Decisions.Exec.actionName,
          // exec тоже требует авторитета кооператива (см. soviet/src/decision/exec.cpp).
          authorization: [{ actor: COOPNAME, permission: 'active' }],
          data: { executer: COOPNAME, coopname: COOPNAME, decision_id: decision.id },
        },
      ],
    }, { blocksBehind: 3, expireSeconds: 30 })
  }

  // Ратификация обрабатывается асинхронно: слушатель ловит ончейн-решение и
  // проставляет done. Ждём, иначе следующая фаза увидит расширение неготовым.
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const s = await readState()
    if (s.all_done) {
      log('ЦПП принята советом: все шаги ратифицированы')
      return
    }
  }
  throw new Error('шаги отправлены, но расширение так и не перешло в состояние «все шаги завершены»')
}
