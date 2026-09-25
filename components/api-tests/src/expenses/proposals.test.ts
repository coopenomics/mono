/**
 * Служебная записка на расход в шасси расходов: подача членом совета,
 * зеркало записки (expense_proposals), снимки реквизитов получателей
 * (expense_requisite_snapshots), первичные файлы (expense_files), решение
 * совета и права на операции со строками расхода.
 *
 * Записка подаётся одна на файл: строка организации (оплата по счёту) и
 * строка свежего пайщика (аванс под отчёт на его СБП). Остальные проверки
 * ищут её по хэшу — стенд общий.
 *
 * Подача идёт через API (createExpenseProposal), как на рабочем столе.
 * Отказ контракта приходит с кодом (CHAIN_ASSERT или код контракта) и текстом
 * причины; до 25.09.2026 он приходил ответом 500 без кода, а подача через API
 * падала вовсе (C28-80).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, ROLES, caseName, freshMember, gql, gqlError, tokenOf } from '../core'
import {
  CREATE_PROPOSAL,
  PROGRAM_EXPENSE_POOL,
  addSbpMethod,
  approveByCouncil,
  createInput,
  hash64,
  signedStatement,
  uniqueFile,
} from './expenses.helpers'
import type { Draft } from './expenses.helpers'

const PROPOSAL_FIELDS = `proposal_hash coopname username source_wallet status total_planned total_actual
  items{ item_hash mechanics recipient_type recipient description planned_amount actual_amount status }
  statement_doc{ hash } decision_doc{ hash }`
const GET = `query($h:String!){ expenseProposal(proposal_hash:$h){ ${PROPOSAL_FIELDS} } }`
const BY_COOP = `query($c:String!,$o:PaginationInput){ expenseProposalsByCooperative(coopname:$c, options:$o){ items{ proposal_hash status } totalPages currentPage } }`
const BY_MEMBER = `query($c:String!,$u:String!,$o:PaginationInput){ expenseProposalsByMember(coopname:$c, username:$u, options:$o){ items{ proposal_hash username } totalPages } }`
const REQUISITES = `query($c:String!,$h:String!){ expenseRequisitesByProposal(coopname:$c, proposal_hash:$h){ proposal_hash item_hash recipient method_type data requisites payment_purpose } }`
const PAY = `mutation($d:PayExpenseItemInput!){ payExpenseItem(data:$d){ __typename } }`
const RETURN = `mutation($d:ReturnExpenseItemInput!){ returnExpenseItem(data:$d){ __typename } }`
const REPORT = `mutation($d:ReportExpenseItemInput!){ reportExpenseItem(data:$d){ outcome } }`
const SUBMIT = `mutation($d:SubmitExpenseReportInput!){ submitExpenseReport(data:$d){ __typename } }`
const FILE_FIELDS = 'id coopname proposal_hash item_hash kind checksum_sha256 mime_type size_bytes storage_key original_filename uploaded_by_username uploaded_at read_url'
const UPLOAD = `mutation($d:UploadExpenseFileInput!){ uploadExpenseFile(data:$d){ ${FILE_FIELDS} } }`
const FILE = `query($id:Int!){ expenseFile(id:$id){ ${FILE_FIELDS} } }`
const FILES_BY_PROPOSAL = `query($c:String!,$h:String!){ expenseFilesByProposal(coopname:$c, proposal_hash:$h){ id kind item_hash uploaded_by_username read_url } }`
const FILES_BY_ITEM = `query($c:String!,$h:String!,$i:String!){ expenseFilesByItem(coopname:$c, proposal_hash:$h, item_hash:$i){ id kind item_hash } }`

const ORG_REQUISITES = 'ООО «Поставщик-Тест», ИНН 7700000000, р/с 40702810900000000002, БИК 044525225'
const ORG_PURPOSE = 'Оплата по счёту № 17 за канцелярские товары'
const PHONE = '+79990001122'

/** Ищет записку в постраничном списке кооператива. */
async function findInCoopList(token: string, proposalHash: string): Promise<any | undefined> {
  for (let page = 1; page <= 50; page++) {
    const d = await gql<any>(token, BY_COOP, { c: COOP, o: { page, limit: 50, sortOrder: 'DESC' } })
    const hit = d.expenseProposalsByCooperative.items.find((p: any) => p.proposal_hash === proposalHash)
    if (hit)
      return hit
    if (page >= d.expenseProposalsByCooperative.totalPages)
      return undefined
  }
  return undefined
}

async function findInMemberList(token: string, username: string, proposalHash: string): Promise<any | undefined> {
  for (let page = 1; page <= 50; page++) {
    const d = await gql<any>(token, BY_MEMBER, { c: COOP, u: username, o: { page, limit: 50, sortOrder: 'DESC' } })
    const hit = d.expenseProposalsByMember.items.find((p: any) => p.proposal_hash === proposalHash)
    if (hit)
      return hit
    if (page >= d.expenseProposalsByMember.totalPages)
      return undefined
  }
  return undefined
}

function fileInput(proposalHash: string, itemHash: string | null, kind: string, mime: 'application/pdf' | 'image/png', over: Record<string, unknown> = {}): Record<string, unknown> {
  const f = uniqueFile(mime)
  return {
    coopname: COOP,
    proposal_hash: proposalHash,
    item_hash: itemHash ?? undefined,
    kind,
    mime_type: mime,
    original_filename: mime === 'application/pdf' ? 'schet-17.pdf' : 'chek.png',
    size_bytes: f.size,
    checksum_sha256: f.sha256,
    content_base64: f.base64,
    ...over,
  }
}

describe('expenses: служебная записка на расход', () => {
  let council: string
  let chairman: string
  let member: string
  let other: string
  let recipient: Who
  let recipientToken: string
  let methodId: string
  let draft: Draft
  let statement: any
  let orgItem: string
  let memberItem: string

  beforeAll(async () => {
    council = await tokenOf(COUNCIL)
    chairman = await tokenOf(CHAIRMAN)
    member = await tokenOf(ROLES.member())
    other = await tokenOf(ROLES.otherMember())

    recipient = freshMember({ prefix: 'exp', firstName: 'Аванс', lastName: 'Подотчётный' })
    recipientToken = await tokenOf(recipient)
    methodId = await addSbpMethod(recipient, PHONE)

    orgItem = hash64()
    memberItem = hash64()
    draft = {
      author: COUNCIL,
      proposal_hash: hash64(),
      source_wallet: PROGRAM_EXPENSE_POOL,
      description: 'Хозяйственные расходы программы (api-tests)',
      items: [
        {
          item_hash: orgItem,
          mechanics: 'DIRECT',
          recipient_type: 'ORG',
          recipient: '',
          recipient_name: 'ООО «Поставщик-Тест»',
          description: 'Канцелярские товары',
          planned_amount: '1500.0000 RUB',
          requisites: ORG_REQUISITES,
          payment_purpose: ORG_PURPOSE,
        },
        {
          item_hash: memberItem,
          mechanics: 'ADVANCE',
          recipient_type: 'MEMBER',
          recipient: recipient.account,
          recipient_name: 'Аванс Подотчётный',
          description: 'Закупка расходных материалов',
          planned_amount: '700.0000 RUB',
          payment_method_id: methodId,
        },
      ],
    }
    statement = await signedStatement(draft)
  })

  // ── Подача и чтение ──────────────────────────────────────────────────────

  it(caseName('exp.prop.happy.01', 'член совета подаёт записку через API: строка организации и аванс пайщику'), async () => {
    // До 25.09.2026 createExpenseProposal всегда падал 500 («toDocument is not a
    // function»), и записку приходилось класть в цепь мимо контроллера.
    await gql(council, CREATE_PROPOSAL, { d: createInput(draft, statement) })
    const p = (await gql<any>(chairman, GET, { h: draft.proposal_hash })).expenseProposal
    expect(p?.status).toBe('CREATED')
    expect(p.username).toBe(COUNCIL.account)
  })

  it(caseName('exp.req.happy.01', 'после подачи сняты реквизиты получателей: организации — как введены, пайщику — его СБП'), async () => {
    const rows = (await gql<any>(council, REQUISITES, { c: COOP, h: draft.proposal_hash })).expenseRequisitesByProposal as any[]
    expect(rows).toHaveLength(2)
    const org = rows.find(r => r.item_hash === orgItem)
    const adv = rows.find(r => r.item_hash === memberItem)
    expect(org).toMatchObject({ requisites: ORG_REQUISITES, payment_purpose: ORG_PURPOSE })
    expect(adv?.recipient).toBe(recipient.account)
    expect(String(adv?.method_type).toLowerCase()).toBe('sbp')
    expect(JSON.stringify(adv?.data)).toContain(PHONE)
    expect(String(adv?.payment_purpose)).toMatch(/аванс/i)
  })

  // До 25.09.2026 отказ контракта в мутации приходил ответом 500 без кода:
  // клиент цепи превращал его в простую ошибку (C28-80).
  it(caseName('exp.prop.side.02', 'повторная подача записки с тем же хэшем — отказ цепи с кодом, снимков реквизитов по-прежнему два'), async () => {
    const err = await gqlError(council, CREATE_PROPOSAL, { d: createInput(draft, statement) })
    expect(err?.code).toBe('CHAIN_ASSERT')
    expect(err?.message).toContain('уже существует')
    const rows = (await gql<any>(council, REQUISITES, { c: COOP, h: draft.proposal_hash })).expenseRequisitesByProposal as any[]
    expect(rows).toHaveLength(2)
  })

  it(caseName('exp.prop.side.05', 'кошелёк-источник без набора операций шасси — отказ цепи с кодом, записки нет'), async () => {
    const h = hash64()
    const items = draft.items.map(it => ({ ...it, item_hash: hash64() }))
    const err = await gqlError(council, CREATE_PROPOSAL, { d: createInput({ ...draft, proposal_hash: h, items, source_wallet: 'w.cap.blago' }, statement) })
    expect(err?.code).toBe('CHAIN_ASSERT')
    expect(err?.message).toMatch(/source_wallet|набор операций/)
    expect((await gql<any>(chairman, GET, { h })).expenseProposal).toBeNull()
  })

  it(caseName('exp.prop.happy.05', 'записка, поданная в цепь, приходит в зеркало: статус CREATED, строки и документ'), async () => {
    const p = (await gql<any>(chairman, GET, { h: draft.proposal_hash })).expenseProposal
    expect(p.status).toBe('CREATED')
    expect(p.coopname).toBe(COOP)
    expect(p.username).toBe(COUNCIL.account)
    expect(p.source_wallet).toBe(PROGRAM_EXPENSE_POOL)
    expect(p.total_planned).toBe('2200.0000 RUB')
    expect(p.statement_doc?.hash?.toLowerCase()).toBe(String(statement.hash).toLowerCase())
    expect(p.decision_doc).toBeNull()

    const org = p.items.find((i: any) => i.item_hash === orgItem)
    const adv = p.items.find((i: any) => i.item_hash === memberItem)
    expect(org).toMatchObject({ mechanics: 'DIRECT', recipient_type: 'ORG', planned_amount: '1500.0000 RUB', status: 'APPROVED' })
    expect(adv).toMatchObject({ mechanics: 'ADVANCE', recipient_type: 'MEMBER', recipient: recipient.account, planned_amount: '700.0000 RUB', status: 'APPROVED' })
  })

  it(caseName('exp.prop.happy.02', 'записка видна в реестре кооператива и в списке её автора, но не в списке другого пайщика'), async () => {
    expect((await findInCoopList(chairman, draft.proposal_hash))?.status).toBe('CREATED')
    expect(await findInMemberList(council, COUNCIL.account, draft.proposal_hash)).toMatchObject({ username: COUNCIL.account })
    expect(await findInMemberList(chairman, ROLES.otherMember().account, draft.proposal_hash)).toBeUndefined()
  })

  it(caseName('exp.req.side.01', 'реквизиты получателей — только совету: пайщик и сам получатель получают отказ'), async () => {
    for (const token of [member, recipientToken]) {
      const err = await gqlError(token, REQUISITES, { c: COOP, h: draft.proposal_hash })
      expect(err?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    }
  })

  it(caseName('exp.prop.side.01', 'пайщик не подаёт записку: от своего имени — EXPENSES_PROPOSAL_FORBIDDEN, от чужого — отказ по роли'), async () => {
    const own = { ...draft, author: ROLES.member(), proposal_hash: hash64() }
    const self = await gqlError(member, CREATE_PROPOSAL, { d: createInput(own, statement) })
    expect(self?.code).toBe('EXPENSES_PROPOSAL_FORBIDDEN')
    const foreign = await gqlError(member, CREATE_PROPOSAL, { d: createInput({ ...draft, proposal_hash: own.proposal_hash }, statement) })
    expect(foreign?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    const d = await gql<any>(chairman, GET, { h: own.proposal_hash })
    expect(d.expenseProposal).toBeNull()
  })

  it(caseName('exp.prop.side.03', 'строка пайщика без его реквизитов отвергается до цепи'), async () => {
    const h = hash64()
    const items = draft.items.map(it => it.item_hash === memberItem ? { ...it, item_hash: hash64(), payment_method_id: undefined } : { ...it, item_hash: hash64() })
    const err = await gqlError(council, CREATE_PROPOSAL, { d: createInput({ ...draft, proposal_hash: h, items }, statement) })
    expect(err?.code).toBe('EXPENSES_RECIPIENT_REQUISITES_MISSING')
    expect((await gql<any>(chairman, GET, { h })).expenseProposal).toBeNull()
  })

  it(caseName('exp.prop.side.04', 'организации — только оплата по счёту, пайщику — только аванс'), async () => {
    const orgAdvance = [{ ...draft.items[0], item_hash: hash64(), mechanics: 'ADVANCE' as const }]
    const e1 = await gqlError(council, CREATE_PROPOSAL, { d: createInput({ ...draft, proposal_hash: hash64(), items: orgAdvance }, statement) })
    expect(e1?.code).toBe('EXPENSES_ORG_ONLY_DIRECT')
    const memberDirect = [{ ...draft.items[1], item_hash: hash64(), mechanics: 'DIRECT' as const }]
    const e2 = await gqlError(council, CREATE_PROPOSAL, { d: createInput({ ...draft, proposal_hash: hash64(), items: memberDirect }, statement) })
    expect(e2?.code).toBe('EXPENSES_MEMBER_ONLY_ADVANCE')
  })

  it(caseName('exp.prop.side.06', 'реестр кооператива — совету; гость не читает записку'), async () => {
    const err = await gqlError(member, BY_COOP, { c: COOP, o: { page: 1, limit: 10, sortOrder: 'DESC' } })
    expect(err?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    const guest = await gqlError(null, GET, { h: draft.proposal_hash })
    expect(String(guest?.code)).toBe('401')
  })

  // ── Права на операции со строками ────────────────────────────────────────

  it(caseName('exp.prop.side.07', 'оплата строки — только председателю: пайщик и член совета получают отказ по роли'), async () => {
    for (const token of [member, council]) {
      const err = await gqlError(token, PAY, { d: { coopname: COOP, proposal_hash: draft.proposal_hash, item_hash: orgItem, actual_amount: '1500.0000 RUB' } })
      expect(err?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
    }
  })

  it(caseName('exp.prop.side.08', 'до решения совета оплата отвергается цепью'), async () => {
    const err = await gqlError(chairman, PAY, { d: { coopname: COOP, proposal_hash: draft.proposal_hash, item_hash: orgItem, actual_amount: '1500.0000 RUB' } })
    expect(err).not.toBeNull()
    expect(err?.message).toContain('AUTHORIZED')
    expect((await gql<any>(chairman, GET, { h: draft.proposal_hash })).expenseProposal.status).toBe('CREATED')
  })

  it(caseName('exp.prop.side.09', 'возврат и отчёт по авансу: чужой пайщик — 403, держатель аванса и совет проходят проверку прав'), async () => {
    const ret = { coopname: COOP, proposal_hash: draft.proposal_hash, item_hash: memberItem, return_amount: '100.0000 RUB' }
    const rep = { coopname: COOP, proposal_hash: draft.proposal_hash, item_hash: memberItem }

    expect(String((await gqlError(other, RETURN, { d: ret }))?.code)).toBe('403')
    expect(String((await gqlError(other, REPORT, { d: rep }))?.code)).toBe('403')
    // Строка без получателя-пайщика (организация) тоже не «своя» ни для кого из пайщиков.
    expect(String((await gqlError(recipientToken, RETURN, { d: { ...ret, item_hash: orgItem } }))?.code)).toBe('403')

    // Держатель аванса и член совета доходят до цепи: аванс ещё не выдан, и
    // отказ приходит от контракта, а не от проверки прав.
    for (const token of [recipientToken, council]) {
      for (const [q, d] of [[RETURN, ret], [REPORT, rep]] as const) {
        const e = await gqlError(token, q, { d })
        expect(e).not.toBeNull()
        expect(String(e?.code)).not.toBe('403')
        expect(e?.code).not.toBe('KIT_INSUFFICIENT_RIGHTS')
        expect(e?.message).toContain('PARTIALLY_PAID')
      }
    }
    const items = (await gql<any>(chairman, GET, { h: draft.proposal_hash })).expenseProposal.items
    expect(items.find((i: any) => i.item_hash === memberItem).status).toBe('APPROVED')
  })

  it(caseName('exp.prop.side.10', 'закрытие отчёта — совету; пайщик получает отказ по роли'), async () => {
    const err = await gqlError(member, SUBMIT, { d: { coopname: COOP, proposal_hash: draft.proposal_hash } })
    expect(err?.code).toBe('KIT_INSUFFICIENT_RIGHTS')
  })

  // ── Файлы ────────────────────────────────────────────────────────────────

  let proofId: number

  it(caseName('exp.file.happy.01', 'член совета прикладывает платёжку к строке организации — запись читается по id и в списках'), async () => {
    const input = fileInput(draft.proposal_hash, orgItem, 'PAYMENT_PROOF', 'application/pdf')
    const d = await gql<any>(council, UPLOAD, { d: input })
    const f = d.uploadExpenseFile
    proofId = f.id
    expect(f.id).toBeGreaterThan(0)
    expect(f).toMatchObject({
      coopname: COOP,
      proposal_hash: draft.proposal_hash,
      item_hash: orgItem,
      kind: 'PAYMENT_PROOF',
      mime_type: 'application/pdf',
      size_bytes: input.size_bytes,
      checksum_sha256: input.checksum_sha256,
      original_filename: 'schet-17.pdf',
      uploaded_by_username: COUNCIL.account,
    })
    expect(f.storage_key).toContain(draft.proposal_hash)
    expect(f.read_url).toBeTruthy()

    const one = await gql<any>(chairman, FILE, { id: f.id })
    expect(one.expenseFile).toMatchObject({ id: f.id, checksum_sha256: input.checksum_sha256, kind: 'PAYMENT_PROOF' })
    expect(one.expenseFile.read_url).toBeTruthy()

    const byProposal = await gql<any>(chairman, FILES_BY_PROPOSAL, { c: COOP, h: draft.proposal_hash })
    expect(byProposal.expenseFilesByProposal.find((x: any) => x.id === f.id)).toMatchObject({ kind: 'PAYMENT_PROOF', item_hash: orgItem })
    const byItem = await gql<any>(chairman, FILES_BY_ITEM, { c: COOP, h: draft.proposal_hash, i: orgItem })
    expect(byItem.expenseFilesByItem.map((x: any) => x.id)).toContain(f.id)
  })

  it(caseName('exp.file.happy.02', 'получатель аванса прикладывает чек к своей строке и видит файлы своей записки'), async () => {
    const input = fileInput(draft.proposal_hash, memberItem, 'REPORT_FILE', 'image/png')
    const d = await gql<any>(recipientToken, UPLOAD, { d: input })
    const f = d.uploadExpenseFile
    expect(f).toMatchObject({ item_hash: memberItem, kind: 'REPORT_FILE', mime_type: 'image/png', uploaded_by_username: recipient.account })

    const byItem = await gql<any>(recipientToken, FILES_BY_ITEM, { c: COOP, h: draft.proposal_hash, i: memberItem })
    expect(byItem.expenseFilesByItem.map((x: any) => x.id)).toContain(f.id)
    const byProposal = await gql<any>(recipientToken, FILES_BY_PROPOSAL, { c: COOP, h: draft.proposal_hash })
    const ids = byProposal.expenseFilesByProposal.map((x: any) => x.id)
    expect(ids).toContain(f.id)
    expect(ids).toContain(proofId)
    expect((await gql<any>(recipientToken, FILE, { id: f.id })).expenseFile.id).toBe(f.id)
  })

  it(caseName('exp.file.side.01', 'чужой пайщик не загружает и не читает файлы записки'), async () => {
    const up = await gqlError(other, UPLOAD, { d: fileInput(draft.proposal_hash, memberItem, 'REPORT_FILE', 'image/png') })
    expect(up?.code).toBe('EXPENSES_FILE_ACCESS_DENIED')
    expect((await gqlError(other, FILES_BY_PROPOSAL, { c: COOP, h: draft.proposal_hash }))?.code).toBe('EXPENSES_FILE_ACCESS_DENIED')
    expect((await gqlError(other, FILES_BY_ITEM, { c: COOP, h: draft.proposal_hash, i: orgItem }))?.code).toBe('EXPENSES_FILE_ACCESS_DENIED')
    expect((await gqlError(other, FILE, { id: proofId }))?.code).toBe('EXPENSES_FILE_ACCESS_DENIED')
  })

  it(caseName('exp.file.side.02', 'получатель аванса не прикладывает файлы к чужой строке записки'), async () => {
    const err = await gqlError(recipientToken, UPLOAD, { d: fileInput(draft.proposal_hash, orgItem, 'CLOSING_DOC', 'application/pdf') })
    expect(err?.code).toBe('EXPENSES_FILE_ACCESS_DENIED')
    const err2 = await gqlError(recipientToken, FILES_BY_ITEM, { c: COOP, h: draft.proposal_hash, i: orgItem })
    expect(err2?.code).toBe('EXPENSES_FILE_ACCESS_DENIED')
  })

  it(caseName('exp.file.side.03', 'повтор того же содержимого — конфликт, вторая запись не создаётся'), async () => {
    const input = fileInput(draft.proposal_hash, orgItem, 'CLOSING_DOC', 'application/pdf')
    const first = await gql<any>(council, UPLOAD, { d: input })
    const err = await gqlError(council, UPLOAD, { d: input })
    expect(err?.code).toBe('EXPENSES_FILE_DUPLICATE')
    const list = await gql<any>(chairman, FILES_BY_ITEM, { c: COOP, h: draft.proposal_hash, i: orgItem })
    const same = list.expenseFilesByItem.filter((x: any) => x.id === first.uploadExpenseFile.id)
    expect(same).toHaveLength(1)
  })

  it(caseName('exp.file.side.04', 'содержимое не сходится с заявленными размером и контрольной суммой; чужой MIME отвергается'), async () => {
    const base = fileInput(draft.proposal_hash, orgItem, 'CLOSING_DOC', 'application/pdf')
    const size = await gqlError(council, UPLOAD, { d: { ...base, size_bytes: (base.size_bytes as number) + 1 } })
    expect(size?.code).toBe('EXPENSES_FILE_SIZE_MISMATCH')
    const sum = await gqlError(council, UPLOAD, { d: { ...base, checksum_sha256: 'a'.repeat(64) } })
    expect(sum?.code).toBe('EXPENSES_FILE_CHECKSUM_MISMATCH')
    const mime = await gqlError(council, UPLOAD, { d: { ...base, mime_type: 'text/html' } })
    expect(String(mime?.code)).toBe('422')
  })

  it(caseName('exp.file.side.05', 'несуществующий файл — отказ «не найден»'), async () => {
    const err = await gqlError(chairman, FILE, { id: 2_000_000_000 })
    expect(err?.code).toBe('EXPENSES_FILE_NOT_FOUND')
  })

  // ── Решение совета ───────────────────────────────────────────────────────

  it(caseName('exp.prop.happy.03', 'совет утверждает записку — зеркало переходит в AUTHORIZED с протоколом решения'), async () => {
    await approveByCouncil(draft.proposal_hash)
    const d = await gql<any>(chairman, GET, { h: draft.proposal_hash })
    expect(d.expenseProposal.status).toBe('AUTHORIZED')
    expect(d.expenseProposal.decision_doc?.hash).toBeTruthy()
    expect((await findInCoopList(chairman, draft.proposal_hash))?.status).toBe('AUTHORIZED')
  })

  it(caseName('exp.prop.side.11', 'после утверждения: оплата сверх плана и по чужой строке отвергаются цепью, записка остаётся AUTHORIZED'), async () => {
    const over = await gqlError(chairman, PAY, { d: { coopname: COOP, proposal_hash: draft.proposal_hash, item_hash: orgItem, actual_amount: '1500.0001 RUB' } })
    expect(over).not.toBeNull()
    expect(over?.message).toContain('план')
    const unknown = await gqlError(chairman, PAY, { d: { coopname: COOP, proposal_hash: draft.proposal_hash, item_hash: hash64(), actual_amount: '10.0000 RUB' } })
    expect(unknown).not.toBeNull()
    expect(unknown?.message).toContain('не найден')
    const d = await gql<any>(chairman, GET, { h: draft.proposal_hash })
    expect(d.expenseProposal.status).toBe('AUTHORIZED')
    expect(d.expenseProposal.items.every((i: any) => i.status === 'APPROVED')).toBe(true)
  })

  it(caseName('exp.prop.side.12', 'закрыть отчёт по утверждённой, но не оплаченной записке нельзя'), async () => {
    const err = await gqlError(council, SUBMIT, { d: { coopname: COOP, proposal_hash: draft.proposal_hash } })
    expect(err).not.toBeNull()
    expect(err?.message).toContain('REPORT_SUBMITTED')
    expect((await gql<any>(chairman, GET, { h: draft.proposal_hash })).expenseProposal.status).toBe('AUTHORIZED')
  })
})
