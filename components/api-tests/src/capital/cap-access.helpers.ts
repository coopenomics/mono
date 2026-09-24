/**
 * Благорост для внешних тестов доступа, избранного, списков и приоритетов:
 * проекты в цепи, участники с договором УХД и допуском, ведущие и соавторы,
 * личные проекты, задачи и требования, комнаты переписки и записи звонков.
 *
 * Здесь только подготовка и чтение — ассертов нет, проверки живут в тестах.
 *
 * Как готовится состояние:
 *  - проект, ведущий, соавтор, задача, требование — через API, как рабочий
 *    стол председателя и ведущего;
 *  - договор УХД и допуск к проекту — прямо в цепь от имени кооператива
 *    (так их отправляет контроллер после подписи пайщика), одобрение —
 *    действием председателя `soviet::confirmapprv`. Документы подписаны
 *    ключом самого пайщика: контракт сверяет подпись с его аккаунтом;
 *  - комнаты переписки и записи звонков — сидом в базу: на стенде нет
 *    Matrix и LiveKit, а реестр комнат и записи заводят только они.
 */
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { tableRows, transact } from '../core/chain'
import { gql, gqlRaw } from '../core/client'
import { COOP, DEFAULT_WIF, REPO_ROOT } from '../core/env'
import { CHAIRMAN } from '../core/roles'
import { waitFor } from '../core/wait'
import { COOP_SIGNER } from '../core/wallet'

export const ZERO_HASH = '0'.repeat(64)

export function randomHash(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** Короткая метка прогона — по ней свои объекты находятся в общих списках. */
export function tag(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`
}

// ── Документы ──────────────────────────────────────────────────────────────

/** Подписанный документ цепи (document2) с подписью `signer` его ключом. */
export function signedDoc(signer: string, wif: string, hash = randomHash()) {
  return {
    version: '1.0.0',
    hash,
    doc_hash: hash,
    meta_hash: hash,
    meta: '{}',
    signatures: [{
      id: 1,
      signed_hash: hash,
      signer,
      public_key: ecc.privateToPublic(wif),
      signature: ecc.signHash(hash, wif),
      signed_at: new Date().toISOString().slice(0, 19),
      meta: '{}',
    }],
  }
}

// ── Благорост в цепи ───────────────────────────────────────────────────────

const PROGRAMS = [
  { id: 3, type: 'generator', title: 'Договор УХД', spend: true },
  { id: 4, type: 'capital', title: 'Благорост', spend: false },
]

let chainReady: Promise<void> | null = null

/**
 * Программы «Генератор» и «Благорост» и конфигурация контракта capital. На
 * полном прогоне их заводят прежние наборы boot, на быстром полигоне — этот
 * помощник; повторный вызов ничего не меняет.
 */
export function ensureCapitalChainReady(): Promise<void> {
  chainReady ??= (async () => {
    const programs = await tableRows<any>('soviet', COOP, 'programs')
    for (const p of PROGRAMS) {
      if (programs.some(r => Number(r.id) === p.id))
        continue
      await transact(CHAIRMAN, [{
        account: 'soviet',
        name: 'createprog',
        data: {
          coopname: COOP,
          username: CHAIRMAN.account,
          type: p.type,
          title: p.title,
          announce: '',
          description: '',
          preview: '',
          images: '',
          calculation_type: 'free',
          fixed_membership_contribution: '0.0000 RUB',
          membership_percent_fee: 0,
          is_can_coop_spend_share_contributions: p.spend,
          meta: '',
        },
      }])
    }
    const state = await tableRows<any>('capital', 'capital', 'state')
    if (!state.some(s => s.coopname === COOP)) {
      await transact(COOP_SIGNER, [{
        account: 'capital',
        name: 'setconfig',
        data: {
          coopname: COOP,
          config: {
            coordinator_bonus_percent: 4,
            expense_pool_percent: 100,
            coordinator_invite_validity_days: 30,
            voting_period_in_days: 7,
            authors_voting_percent: 38.2,
            creators_voting_percent: 38.2,
            energy_decay_rate_per_day: 0.11,
            level_depth_base: 1000,
            level_growth_coefficient: 1.5,
            energy_gain_coefficient: 0.01,
          },
        },
      }])
    }
  })()
  return chainReady
}

/**
 * Одобрение председателя по хэшу заявки. Если робот совета уже одобрил её
 * сам, заявки в цепи нет — это и есть нужное состояние.
 */
export async function approveAsChairman(approvalHash: string): Promise<void> {
  try {
    await transact(COOP_SIGNER, [{
      account: 'soviet',
      name: 'confirmapprv',
      data: {
        coopname: COOP,
        username: CHAIRMAN.account,
        approval_hash: approvalHash,
        approved_document: signedDoc(CHAIRMAN.account, DEFAULT_WIF),
      },
    }])
  }
  catch (e: any) {
    const text = JSON.stringify(e?.json ?? e?.message ?? e)
    if (!/Апррувал не найден/.test(text))
      throw e
  }
}

/** Договор УХД пайщика в цепи и его одобрение председателем. */
export async function registerContributor(who: Who): Promise<void> {
  const contributorHash = randomHash()
  const doc = () => signedDoc(who.account, who.wif)
  await transact(COOP_SIGNER, [{
    account: 'capital',
    name: 'regcontrib',
    data: {
      coopname: COOP,
      username: who.account,
      contributor_hash: contributorHash,
      rate_per_hour: '1000.0000 RUB',
      hours_per_day: 8,
      is_external_contract: false,
      storage_agreement: doc(),
      contract: doc(),
      blagorost_agreement: doc(),
      generator_agreement: null,
    },
  }])
  await approveAsChairman(contributorHash)
}

const PROJECT_FIELDS = `project_hash parent_hash title description invite master priority origin present
  permissions { can_view_artifacts can_set_priority has_clearance pending_clearance is_guest can_manage_issues can_create_requirement }`

/** Проект глазами `who` — с его правами (null, если проект ему не виден). */
export async function projectAs(who: Who, hash: string): Promise<any | null> {
  const d = await gql<any>(await tokenOf(who),
    `query($d:GetProjectInput!){ capitalProject(data:$d){ ${PROJECT_FIELDS} } }`,
    { d: { hash } })
  return d.capitalProject
}

/**
 * Допуск пайщика к проекту: приложение к договору УХД в цепи, затем
 * одобрение председателя. Контроллер разбирает блоки по порядку: заявка
 * (дельта таблицы приложений) попадает в базу раньше одобрения, поэтому
 * ждать между ними нечего — ждём только сам подтверждённый допуск.
 */
export async function grantClearance(who: Who, projectHash: string): Promise<void> {
  const appendixHash = randomHash()
  await transact(COOP_SIGNER, [{
    account: 'capital',
    name: 'getclearance',
    data: {
      coopname: COOP,
      username: who.account,
      project_hash: projectHash,
      appendix_hash: appendixHash,
      document: signedDoc(who.account, who.wif),
    },
  }])
  await approveAsChairman(appendixHash)
  await waitFor(async () => {
    const p = await projectAs(who, projectHash)
    return p?.permissions?.has_clearance ? true : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label: `допуск ${who.account} к ${projectHash.slice(0, 8)} подтверждён` })
}

/** Проект (или компонент) в цепи — председатель через API. */
export async function createChainProject(title: string, parentHash = ZERO_HASH, extra: { description?: string, invite?: string } = {}): Promise<string> {
  const hash = randomHash()
  await gql(await tokenOf(CHAIRMAN),
    'mutation($d:CreateProjectInput!){ capitalCreateProject(data:$d){ __typename } }',
    {
      d: {
        coopname: COOP,
        project_hash: hash,
        parent_hash: parentHash,
        title,
        description: extra.description ?? `Проект внешнего теста «${title}».`,
        invite: extra.invite ?? '',
        meta: '',
        data: '',
      },
    })
  await waitFor(async () => (await projectAs(CHAIRMAN, hash)) ? true : null,
    { timeoutMs: 60_000, intervalMs: 1_000, label: `проект ${title} в зеркале` })
  return hash
}

/** Ведущий проекта — председатель через API. */
export async function setMaster(projectHash: string, master: Who): Promise<void> {
  await gql(await tokenOf(CHAIRMAN),
    'mutation($d:SetMasterInput!){ capitalSetMaster(data:$d){ __typename } }',
    { d: { coopname: COOP, project_hash: projectHash, master: master.account } })
  await waitFor(async () => (await projectAs(CHAIRMAN, projectHash))?.master === master.account ? true : null,
    { timeoutMs: 60_000, intervalMs: 1_000, label: `ведущий ${master.account} в зеркале` })
}

/** Соавтор проекта — председатель через API. */
export async function addAuthor(projectHash: string, author: Who): Promise<void> {
  await gql(await tokenOf(CHAIRMAN),
    'mutation($d:AddAuthorInput!){ capitalAddAuthor(data:$d){ project_hash } }',
    { d: { coopname: COOP, project_hash: projectHash, author: author.account } })
}

/** Пайщик с договором УХД и допуском к перечисленным проектам. */
export async function admitted(who: Who, projectHashes: string[]): Promise<Who> {
  await registerContributor(who)
  for (const hash of projectHashes)
    await grantClearance(who, hash)
  return who
}

// ── Личные проекты, задачи, требования ─────────────────────────────────────

/** Личный проект (или компонент личного проекта) пайщика — без цепи. */
export async function createLocalProject(owner: Who, title: string, parentHash = '', extra: { description?: string, invite?: string } = {}): Promise<any> {
  const d = await gql<any>(await tokenOf(owner),
    `mutation($d:CreateProjectInput!){ capitalCreateLocalProject(data:$d){ ${PROJECT_FIELDS} } }`,
    {
      d: {
        coopname: COOP,
        project_hash: randomHash(),
        parent_hash: parentHash,
        title,
        description: extra.description ?? `Личный проект внешнего теста «${title}».`,
        invite: extra.invite ?? '',
        meta: '',
        data: '',
      },
    })
  return d.capitalCreateLocalProject
}

export const ISSUE_FIELDS = 'issue_hash title description priority project_hash submaster creators permissions { can_set_priority can_edit_issue }'

export async function createIssue(who: Who, input: { title: string, project_hash?: string, description?: string, creators?: string[] }): Promise<any> {
  const d = await gql<any>(await tokenOf(who),
    `mutation($d:CreateIssueInput!){ capitalCreateIssue(data:$d){ ${ISSUE_FIELDS} } }`,
    { d: { coopname: COOP, ...input } })
  return d.capitalCreateIssue
}

export async function createStory(who: Who, input: { title: string, project_hash?: string, issue_hash?: string, description?: string }): Promise<any> {
  const d = await gql<any>(await tokenOf(who),
    'mutation($d:CreateStoryInput!){ capitalCreateStory(data:$d){ story_hash title project_hash issue_hash description } }',
    { d: { coopname: COOP, story_hash: randomHash(), ...input } })
  return d.capitalCreateStory
}

export async function issuesAs(who: Who | null, filter: Record<string, unknown>, options?: Record<string, unknown>) {
  const token = who ? await tokenOf(who) : null
  return gqlRaw<any>(token,
    `query($f:CapitalIssueFilter,$o:PaginationInput){ capitalIssues(filter:$f, options:$o){ totalCount totalPages items{ ${ISSUE_FIELDS} } } }`,
    { f: filter, o: options })
}

export async function storiesAs(who: Who, filter: Record<string, unknown>) {
  const d = await gql<any>(await tokenOf(who),
    'query($f:CapitalStoryFilter,$o:PaginationInput){ capitalStories(filter:$f, options:$o){ totalCount items{ story_hash project_hash issue_hash } } }',
    { f: filter, o: { page: 1, limit: 100 } })
  return d.capitalStories as { totalCount: number, items: any[] }
}

export async function storyAs(who: Who, storyHash: string): Promise<any | null> {
  const d = await gql<any>(await tokenOf(who),
    'query($d:GetCapitalStoryByHashInput!){ capitalStory(data:$d){ story_hash } }',
    { d: { story_hash: storyHash } })
  return d.capitalStory
}

// ── Переписка: реестр комнат и записи звонков (сид в базу) ─────────────────

/**
 * SQL в базу стенда через контейнер postgres. Только для сида того, что на
 * стенде заводит внешний сервис (Matrix, LiveKit); проверка — через API.
 */
export function seedSql(query: string): string {
  const r = spawnSync('docker', [
    'compose', 'exec', '-T', 'postgres',
    'psql', '-U', 'postgres', '-d', process.env.POSTGRES_DATABASE || COOP,
    '-v', 'ON_ERROR_STOP=1', '-tAq', '-c', query,
  ], { cwd: REPO_ROOT, encoding: 'utf8' })
  if (r.status !== 0)
    throw new Error(`psql упал (${r.status}): ${(r.stderr || r.stdout || String(r.error ?? '')).slice(-1500)}`)
  return (r.stdout || '').trim()
}

function lit(v: string | null): string {
  return v === null ? 'NULL' : `'${v.replace(/'/g, '\'\'')}'`
}

export type RoomKind = 'capital_project' | 'members' | 'council' | 'secretary'

/** Комната в реестре ChatCoop; возвращает её matrixRoomId. */
export function seedRoom(kind: RoomKind, projectHash: string | null, label: string): string {
  const roomId = `!${tag('capacc')}:blackbox.test`
  seedSql(`INSERT INTO chatcoop_managed_matrix_rooms (matrix_room_id, encrypted, room_kind, display_label, project_hash)
    VALUES (${lit(roomId)}, false, ${lit(kind)}, ${lit(label)}, ${lit(projectHash)})`)
  return roomId
}

/**
 * Завершённая запись звонка с одной репликой. `livekitRoom` — имя комнаты
 * звонка, оно намеренно отличается от комнаты переписки.
 */
export function seedTranscription(matrixRoomId: string, text: string): string {
  const livekitRoom = tag('livekit')
  const out = seedSql(`INSERT INTO chatcoop_call_transcriptions (room_id, matrix_room_id, room_name, started_at, ended_at)
    VALUES (${lit(livekitRoom)}, ${lit(matrixRoomId)}, ${lit(`Звонок ${livekitRoom}`)}, now() - interval '1 hour', now())
    RETURNING id`)
  const id = out.split('\n').map(s => s.trim()).find(s => /^[0-9a-f-]{36}$/.test(s))
  if (!id)
    throw new Error(`сид записи звонка не вернул id: ${out}`)
  seedSql(`INSERT INTO chatcoop_transcription_segments (transcription_id, speaker_identity, speaker_name, text, start_offset, end_offset)
    VALUES (${lit(id)}, '@speaker:blackbox.test', 'Докладчик', ${lit(text)}, 0, 1.5)`)
  return id
}

// ── Переписка: чтение через API ────────────────────────────────────────────

export async function projectRoomsAs(who: Who, projectHash: string) {
  return gqlRaw<any>(await tokenOf(who),
    'query($d:GetProjectCommunicationRoomsInput!){ chatcoopListProjectCommunicationRooms(data:$d){ matrixRoomId displayLabel } }',
    { d: { projectHash } })
}

export async function nonProjectRoomsAs(who: Who) {
  return gqlRaw<any>(await tokenOf(who),
    'query{ chatcoopListNonProjectCommunicationRooms{ matrixRoomId kind } }')
}

export async function roomMessagesAs(who: Who, matrixRoomId: string) {
  return gqlRaw<any>(await tokenOf(who),
    'query($d:GetRoomMessagesForUtcDateInput!){ chatcoopGetRoomMessagesForUtcDate(data:$d){ originServerTs bodyText } }',
    { d: { matrixRoomId, utcDate: new Date().toISOString().slice(0, 10) } })
}

export async function roomDatesAs(who: Who, matrixRoomId: string) {
  return gqlRaw<any>(await tokenOf(who),
    'query($d:ListUtcDatesWithNewRoomMessagesInput!){ chatcoopListUtcDatesWithNewRoomMessages(data:$d) }',
    { d: { matrixRoomId, afterOriginServerTsExclusive: 0 } })
}

const TRANSCRIPTION_FIELDS = 'id roomId roomName memo'

export async function transcriptionsAs(who: Who, matrixRoomId?: string) {
  return gqlRaw<any>(await tokenOf(who),
    `query($d:GetTranscriptionsInput){ chatcoopGetTranscriptions(data:$d){ ${TRANSCRIPTION_FIELDS} } }`,
    { d: { limit: 100, offset: 0, ...(matrixRoomId ? { matrixRoomId } : {}) } })
}

export async function transcriptionAs(who: Who, id: string) {
  return gqlRaw<any>(await tokenOf(who),
    `query($d:GetTranscriptionInput!){ chatcoopGetTranscription(data:$d){ transcription{ ${TRANSCRIPTION_FIELDS} } segments{ text speakerIdentity } } }`,
    { d: { id } })
}

export async function updateMemoAs(who: Who, id: string, memo: string) {
  return gqlRaw<any>(await tokenOf(who),
    `mutation($d:UpdateCallTranscriptionMemoInput!){ chatcoopUpdateTranscriptionMemo(data:$d){ ${TRANSCRIPTION_FIELDS} } }`,
    { d: { id, memo } })
}

// ── Избранное ──────────────────────────────────────────────────────────────

export type FavoriteType = 'PROJECT' | 'COMPONENT' | 'ISSUE' | 'ARTIFACT'

const FAVORITE_FIELDS = 'target_type target_hash title parent_hash username'

export async function favoritesAs(who: Who, owner: string = who.account) {
  return gqlRaw<any>(await tokenOf(who),
    `query($f:CapitalFavoritesFilter!){ capitalFavorites(filter:$f){ ${FAVORITE_FIELDS} } }`,
    { f: { coopname: COOP, username: owner } })
}

export async function addFavoriteAs(who: Who, type: FavoriteType, hash: string, owner: string = who.account) {
  return gqlRaw<any>(await tokenOf(who),
    `mutation($d:CapitalFavoriteInput!){ capitalAddFavorite(data:$d){ ${FAVORITE_FIELDS} } }`,
    { d: { coopname: COOP, username: owner, target_type: type, target_hash: hash } })
}

export async function removeFavoriteAs(who: Who, type: FavoriteType, hash: string, owner: string = who.account) {
  return gqlRaw<any>(await tokenOf(who),
    `mutation($d:CapitalFavoriteInput!){ capitalRemoveFavorite(data:$d){ ${FAVORITE_FIELDS} } }`,
    { d: { coopname: COOP, username: owner, target_type: type, target_hash: hash } })
}

/** Свои записи избранного (ответ без ошибок, иначе исключение с кодами). */
export async function myFavorites(who: Who): Promise<any[]> {
  const r = await favoritesAs(who)
  if (r.errors.length)
    throw new Error(`capitalFavorites: ${JSON.stringify(r.errors)}`)
  return r.data.capitalFavorites
}

export async function deleteIssueAsChairman(issueHash: string): Promise<void> {
  await gql(await tokenOf(CHAIRMAN),
    'mutation($d:DeleteCapitalIssueByHashInput!){ capitalDeleteIssue(data:$d) }',
    { d: { issue_hash: issueHash } })
}

export async function deleteStoryAs(who: Who, storyHash: string): Promise<void> {
  await gql(await tokenOf(who),
    'mutation($d:DeleteCapitalStoryByHashInput!){ capitalDeleteStory(data:$d) }',
    { d: { story_hash: storyHash } })
}

export async function deleteProjectAsChairman(projectHash: string): Promise<void> {
  await gql(await tokenOf(CHAIRMAN),
    'mutation($d:DeleteProjectInput!){ capitalDeleteProject(data:$d){ __typename } }',
    { d: { coopname: COOP, project_hash: projectHash } })
}
