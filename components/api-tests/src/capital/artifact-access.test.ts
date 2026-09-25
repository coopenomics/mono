/**
 * Благорост: кто читает документы проекта и его переписку
 * (test-registry/capital.artifact-access.yaml).
 *
 * Документы проекта — карточка, задачи, требования — читают председатель,
 * член совета, ведущий, соавтор и пайщик с подтверждённым допуском.
 * Переписку и записи звонков — только совет и ведущий: допуск к работам
 * переписку не открывает. Роль на проекте распространяется на его
 * компоненты.
 *
 * Мир теста: проект P в цепи с компонентом K и чужой проект Q; ведущий M,
 * допущенный C и соавтор A — свежие пайщики с договором УХД и допуском к P;
 * посторонний O — пайщик без роли. Комнаты переписки и записи звонков
 * заведены сидом в реестр ChatCoop (на стенде нет Matrix), всё проверяемое
 * читается через API.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, ROLES, caseName, freshMember } from '../core'
import { gqlError } from '../core/client'
import { classify } from '../rights/classify'
import {
  addAuthor,
  admitted,
  createChainProject,
  createIssue,
  createStory,
  ensureCapitalChainReady,
  issuesAs,
  nonProjectRoomsAs,
  projectAs,
  projectRoomsAs,
  randomHash,
  roomDatesAs,
  roomMessagesAs,
  seedRoom,
  seedTranscription,
  setMaster,
  storiesAs,
  storyAs,
  tag,
  transcriptionAs,
  transcriptionsAs,
  updateMemoAs,
} from './cap-access.helpers'

const DENIED = 'CHATCOOP_ROOM_ACCESS_DENIED'

let P = ''
let K = ''
let Q = ''
let M: Who
let C: Who
let A: Who
let O: Who
let T = ''
let issueP: any
let issueK: any
let issueQ: any
let storyP: any
let storyK: any
let roomP = ''
let roomK = ''
let roomGhost = ''
let ghostProjectHash = ''
let roomMembers = ''
let callP = ''
let callMembers = ''
let callGhost = ''

function roomIds(r: { data: any, errors: any[] }, field: string): string[] {
  expect(r.errors, JSON.stringify(r.errors)).toEqual([])
  return (r.data[field] as any[]).map(x => x.matrixRoomId)
}

async function canViewArtifacts(who: Who, hash: string): Promise<boolean> {
  return (await projectAs(who, hash))!.permissions.can_view_artifacts
}

beforeAll(async () => {
  await ensureCapitalChainReady()
  T = tag('acc')
  P = await createChainProject(`Доступ ${T}`)
  K = await createChainProject(`Доступ ${T} — компонент`, { parent_hash: P })
  Q = await createChainProject(`Чужой ${T}`)

  M = freshMember({ prefix: 'capm' })
  C = freshMember({ prefix: 'capc' })
  A = freshMember({ prefix: 'capa' })
  O = ROLES.otherMember()

  await admitted(M, [P])
  await setMaster(P, M)
  await admitted(C, [P])
  await admitted(A, [P])
  await addAuthor(P, A)

  // Одинаковое название — по нему свои задачи и требования находятся в общих
  // списках, где стенд полон чужих.
  issueP = await createIssue(CHAIRMAN, { title: T, project_hash: P })
  issueK = await createIssue(CHAIRMAN, { title: T, project_hash: K })
  issueQ = await createIssue(CHAIRMAN, { title: T, project_hash: Q })
  storyP = await createStory(CHAIRMAN, { title: T, project_hash: P })
  storyK = await createStory(CHAIRMAN, { title: T, project_hash: K })

  roomP = seedRoom('capital_project', P, `Проект ${T}`)
  roomK = seedRoom('capital_project', K, `Компонент ${T}`)
  ghostProjectHash = randomHash()
  roomGhost = seedRoom('capital_project', ghostProjectHash, `Несуществующий проект ${T}`)
  roomMembers = seedRoom('members', null, `Пайщики ${T}`)
  callP = seedTranscription(roomP, `Обсуждение проекта ${T}`)
  callMembers = seedTranscription(roomMembers, `Собрание пайщиков ${T}`)
  callGhost = seedTranscription(`!${tag('unregistered')}:blackbox.test`, `Звонок вне реестра ${T}`)
}, 1_200_000)

describe('Благорост — документы проекта: таблица ролей', () => {
  it(caseName('cap.access.happy.01', 'ведущий читает документы и переписку своего проекта'), async () => {
    expect(await canViewArtifacts(M, P)).toBe(true)
    expect((await storiesAs(M, { project_hash: P })).items.map(s => s.story_hash)).toContain(storyP.story_hash)
    expect(await storyAs(M, storyP.story_hash)).not.toBeNull()
    const issues = await issuesAs(M, { project_hash: P }, { page: 1, limit: 50 })
    expect(issues.errors).toEqual([])
    expect(issues.data.capitalIssues.items.map((i: any) => i.issue_hash)).toContain(issueP.issue_hash)

    expect(roomIds(await projectRoomsAs(M, P), 'chatcoopListProjectCommunicationRooms')).toContain(roomP)
    expect((await roomMessagesAs(M, roomP)).errors).toEqual([])
  })

  it(caseName('cap.access.happy.02', 'пайщик с подтверждённым допуском читает документы проекта'), async () => {
    const p = await projectAs(C, P)
    expect(p!.permissions.has_clearance).toBe(true)
    expect(p!.permissions.can_view_artifacts).toBe(true)
    expect((await storiesAs(C, { project_hash: P })).items.map(s => s.story_hash)).toContain(storyP.story_hash)
    expect(await storyAs(C, storyP.story_hash)).not.toBeNull()
    const issues = await issuesAs(C, { project_hash: P }, { page: 1, limit: 50 })
    expect(issues.data.capitalIssues.items.map((i: any) => i.issue_hash)).toContain(issueP.issue_hash)
  })

  it(caseName('cap.access.side.01', 'допуск к работам переписку не открывает'), async () => {
    expect(roomIds(await projectRoomsAs(C, P), 'chatcoopListProjectCommunicationRooms')).toEqual([])
    expect((await roomMessagesAs(C, roomP)).errors[0]?.code).toBe(DENIED)
  })

  it(caseName('cap.access.side.02', 'соавтор читает документы, но не переписку'), async () => {
    expect(await canViewArtifacts(A, P)).toBe(true)
    expect(await storyAs(A, storyP.story_hash)).not.toBeNull()
    expect(roomIds(await projectRoomsAs(A, P), 'chatcoopListProjectCommunicationRooms')).toEqual([])
    expect((await roomMessagesAs(A, roomP)).errors[0]?.code).toBe(DENIED)
  })

  it(caseName('cap.access.side.03', 'член совета без допуска читает переписку чужого проекта'), async () => {
    expect((await projectAs(COUNCIL, P))!.permissions.has_clearance).toBe(false)
    expect(roomIds(await projectRoomsAs(COUNCIL, P), 'chatcoopListProjectCommunicationRooms')).toContain(roomP)
    expect((await roomMessagesAs(COUNCIL, roomP)).errors).toEqual([])
  })

  it(caseName('cap.access.break.01', 'посторонний пайщик не читает ни документы, ни переписку'), async () => {
    expect(await canViewArtifacts(O, P)).toBe(false)
    expect((await storiesAs(O, { project_hash: P })).items).toEqual([])
    expect(await storyAs(O, storyP.story_hash)).toBeNull()
    const issues = await issuesAs(O, { project_hash: P }, { page: 1, limit: 50 })
    expect(issues.data.capitalIssues.totalCount).toBe(0)
    expect(issues.data.capitalIssues.items).toEqual([])

    expect(roomIds(await projectRoomsAs(O, P), 'chatcoopListProjectCommunicationRooms')).toEqual([])
    expect((await roomMessagesAs(O, roomP)).errors[0]?.code).toBe(DENIED)
  })
})

describe('Благорост — каскад по иерархии', () => {
  it(caseName('cap.access.side.04', 'ведущий проекта читает переписку его компонента'), async () => {
    expect((await projectAs(CHAIRMAN, K))!.master).not.toBe(M.account)
    expect(roomIds(await projectRoomsAs(M, K), 'chatcoopListProjectCommunicationRooms')).toContain(roomK)
    expect((await roomMessagesAs(M, roomK)).errors).toEqual([])
  })

  it(caseName('cap.access.side.05', 'допуск к проекту открывает документы компонента, но не его переписку'), async () => {
    expect(await canViewArtifacts(C, K)).toBe(true)
    expect(await storyAs(C, storyK.story_hash)).not.toBeNull()
    expect((await storiesAs(C, { project_hash: K })).items.map(s => s.story_hash)).toContain(storyK.story_hash)
    expect(roomIds(await projectRoomsAs(C, K), 'chatcoopListProjectCommunicationRooms')).toEqual([])
    expect((await roomMessagesAs(C, roomK)).errors[0]?.code).toBe(DENIED)
  })

  it(caseName('cap.access.break.02', 'переписка несуществующего проекта закрыта даже ведущему другого проекта'), async () => {
    // Комната в реестре есть, проекта за ней нет: совет её видит, ведущий — нет.
    expect(await projectAs(CHAIRMAN, ghostProjectHash)).toBeNull()
    expect(roomIds(await projectRoomsAs(CHAIRMAN, ghostProjectHash), 'chatcoopListProjectCommunicationRooms')).toContain(roomGhost)
    expect(roomIds(await projectRoomsAs(M, ghostProjectHash), 'chatcoopListProjectCommunicationRooms')).toEqual([])
    expect((await roomMessagesAs(M, roomGhost)).errors[0]?.code).toBe(DENIED)
  })
})

describe('Благорост — общие списки без указания проекта', () => {
  it(caseName('cap.access.happy.03', 'председатель видит задачи и требования всего кооператива'), async () => {
    const issues = await issuesAs(CHAIRMAN, { title: T }, { page: 1, limit: 50 })
    expect(issues.errors).toEqual([])
    const hashes = issues.data.capitalIssues.items.map((i: any) => i.issue_hash)
    expect(hashes).toEqual(expect.arrayContaining([issueP.issue_hash, issueK.issue_hash, issueQ.issue_hash]))
    expect(issues.data.capitalIssues.totalCount).toBe(3)
    const stories = await storiesAs(CHAIRMAN, { title: T })
    expect(stories.items.map(s => s.story_hash)).toEqual(expect.arrayContaining([storyP.story_hash, storyK.story_hash]))
  })

  it(caseName('cap.access.side.06', 'ведущему общий список сужается до его проектов и их компонентов'), async () => {
    const issues = await issuesAs(M, { title: T }, { page: 1, limit: 50 })
    expect(issues.errors).toEqual([])
    const hashes = issues.data.capitalIssues.items.map((i: any) => i.issue_hash).sort()
    expect(hashes).toEqual([issueP.issue_hash, issueK.issue_hash].sort())
    expect(issues.data.capitalIssues.totalCount).toBe(2)
    const stories = await storiesAs(M, { title: T })
    expect(stories.items.map(s => s.story_hash).sort()).toEqual([storyP.story_hash, storyK.story_hash].sort())
  })

  it(caseName('cap.access.side.07', 'область переписки у допущенного пуста'), async () => {
    const r = await transcriptionsAs(C)
    expect(r.errors).toEqual([])
    const ids = r.data.chatcoopGetTranscriptions.map((t: any) => t.id)
    expect(ids).not.toContain(callP)
    expect(ids).not.toContain(callMembers)
    expect(ids).not.toContain(callGhost)
  })

  it(caseName('cap.access.break.03', 'общий список без авторизации — отказ, а не весь кооператив'), async () => {
    const issues = await issuesAs(null, { title: T }, { page: 1, limit: 50 })
    expect(issues.data?.capitalIssues ?? null).toBeNull()
    expect(classify(issues.errors[0] ?? null)).toBe('deny-auth')
    const stories = await gqlError(null, 'query($f:CapitalStoryFilter){ capitalStories(filter:$f){ totalCount } }', { f: { title: T } })
    expect(classify(stories)).toBe('deny-auth')
  })
})

describe('Благорост — переписка проверяется по самой комнате', () => {
  it(caseName('cap.access.break.05', 'подставленный идентификатор комнаты чужого проекта не открывает её'), async () => {
    for (const who of [C, O]) {
      expect((await roomMessagesAs(who, roomP)).errors[0]?.code).toBe(DENIED)
      expect((await roomDatesAs(who, roomP)).errors[0]?.code).toBe(DENIED)
      expect((await transcriptionsAs(who, roomP)).errors[0]?.code).toBe(DENIED)
    }
  })

  it(caseName('cap.access.break.06', 'комнаты пайщиков, совета и секретаря пайщику не отдаются'), async () => {
    expect(roomIds(await nonProjectRoomsAs(COUNCIL), 'chatcoopListNonProjectCommunicationRooms')).toContain(roomMembers)
    for (const who of [O, C, M])
      expect(roomIds(await nonProjectRoomsAs(who), 'chatcoopListNonProjectCommunicationRooms')).toEqual([])
    expect((await roomMessagesAs(M, roomMembers)).errors[0]?.code).toBe(DENIED)
  })

  it(caseName('cap.access.break.07', 'список записей звонков без комнаты — только доступные комнаты'), async () => {
    const mine = await transcriptionsAs(M)
    expect(mine.errors).toEqual([])
    const ids = mine.data.chatcoopGetTranscriptions.map((t: any) => t.id)
    expect(ids).toContain(callP)
    expect(ids).not.toContain(callMembers)
    expect(ids).not.toContain(callGhost)

    const outsider = await transcriptionsAs(O)
    const outsiderIds = outsider.data.chatcoopGetTranscriptions.map((t: any) => t.id)
    expect(outsiderIds).not.toContain(callP)
    expect(outsiderIds).not.toContain(callMembers)
  })

  it(caseName('cap.access.side.09', 'ведущий правит заметку к записи звонка своего проекта'), async () => {
    const memo = `Итоги ${T}`
    const r = await updateMemoAs(M, callP, memo)
    expect(r.errors).toEqual([])
    expect(r.data.chatcoopUpdateTranscriptionMemo.memo).toBe(memo)

    const denied = await updateMemoAs(O, callP, 'чужая правка')
    expect(denied.errors[0]?.code).toBe(DENIED)
    const seen = await transcriptionAs(COUNCIL, callP)
    expect(seen.data.chatcoopGetTranscription.transcription.memo).toBe(memo)
  })

  it(caseName('cap.access.happy.04', 'совет и ведущий открывают запись звонка с расшифровкой'), async () => {
    for (const who of [COUNCIL, M]) {
      const r = await transcriptionAs(who, callP)
      expect(r.errors).toEqual([])
      expect(r.data.chatcoopGetTranscription.transcription.id).toBe(callP)
      expect(r.data.chatcoopGetTranscription.segments.map((s: any) => s.text)).toEqual([`Обсуждение проекта ${T}`])
    }
    expect((await transcriptionAs(C, callP)).errors[0]?.code).toBe(DENIED)
  })

  it(caseName('cap.access.break.09', 'доступ к записи считается по комнате переписки, а не по комнате звонка'), async () => {
    const r = await transcriptionAs(CHAIRMAN, callP)
    expect(r.errors).toEqual([])
    const roomOfCall = r.data.chatcoopGetTranscription.transcription.roomId
    expect(roomOfCall).not.toBe(roomP)
    const list = await transcriptionsAs(M, roomP)
    expect(list.errors).toEqual([])
    expect(list.data.chatcoopGetTranscriptions.map((t: any) => t.id)).toContain(callP)
  })

  it(caseName('cap.access.break.10', 'запись звонка комнаты вне реестра закрыта всем, включая совет'), async () => {
    for (const who of [CHAIRMAN, COUNCIL])
      expect((await transcriptionAs(who, callGhost)).errors[0]?.code).toBe(DENIED)
  })
})

describe('Благорост — очистка текста на сервере', () => {
  it(caseName('cap.artacc.show.01', 'скрипт в описании задачи и заметке к звонку вырезается при записи'), async () => {
    const table = '| а | б |\n|---|---|\n| 1 | 2 |'
    const dirty = `Описание<script>fetch("/steal")</script> задачи\n\n${table}`
    const issue = await createIssue(CHAIRMAN, { title: `${T} очистка`, project_hash: P, description: dirty })
    expect(issue.description).not.toContain('<script')
    expect(issue.description).toContain('Описание')
    expect(issue.description).toContain(table)

    const memo = await updateMemoAs(M, callP, `Заметка<img src="/x.png" onerror="alert(1)"> ${table}`)
    expect(memo.errors).toEqual([])
    const saved = memo.data.chatcoopUpdateTranscriptionMemo.memo as string
    expect(saved).not.toContain('onerror')
    expect(saved).toContain('<img src="/x.png">')
    expect(saved).toContain(table)
  })
})
