/**
 * Фаза 04b — активация УХД-договора председателя через `chairmanConfirmApprove`.
 *
 * Phase 04 создаёт Contributor через Capital flow (Generate → Sign → Complete),
 * но возвращённый row остаётся в статусе `pending` — для активации совет
 * должен утвердить пакет одобрения, который Capital поставил в очередь
 * (`Soviet::make_pending_approve` внутри `capital::regcontrib`). При обычном
 * boot:extra (5 членов совета) утверждение идёт через стандартный flow
 * голосования; для plain boot или быстрого «пропуска» одобрения по shortcut'у
 * для одного председателя — этого не происходит.
 *
 * Без активного УХД любая попытка обновить ставку/часы/назначить мастера
 * валится с «Договор УХД с пайщиком не активен».
 *
 * Реальный путь без хардкода:
 *   - читаем pending-approval из таблицы `chairman_approvals` postgres
 *     (parser положил туда `document` — реальный signedDocument с подписью ant
 *     как участника);
 *   - председатель добавляет ВТОРУЮ подпись (signatureId=2) к тому же
 *     документу через client.Document.signDocument(..., existingSignedDocuments=[doc]);
 *   - отправляем `Mutations.Chairman.ConfirmApprove` с approved_document =
 *     документ с двумя подписями. Ничего хардкоженого.
 *
 * Идемпотентно: если УХД уже active — фаза no-op.
 */
import { Client, Mutations } from '@coopenomics/sdk'
import { CapitalContract } from 'cooptypes'
import { Client as PgClient } from 'pg'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:04b]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'

interface IContributorRow {
  username?: string
  status?: string
  contributor_hash?: string
}

interface ISignedDocument {
  version: string
  hash: string
  doc_hash: string
  meta_hash: string
  meta: unknown
  signatures: Array<{
    id: number
    signed_hash: string
    signer: string
    public_key: string
    signature: string
    signed_at: string
    meta: unknown
  }>
}

async function fetchApprovalDocument(approvalHash: string): Promise<ISignedDocument | null> {
  const pg = new PgClient({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: COOPNAME,
  })
  await pg.connect()
  try {
    const r = await pg.query<{ document: ISignedDocument; status: string }>(
      `SELECT document, status FROM chairman_approvals WHERE approval_hash = $1 LIMIT 1`,
      [approvalHash.toLowerCase()],
    )
    return r.rows[0]?.document ?? null
  } finally {
    await pg.end()
  }
}

export async function phase04b(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'contributors',
    1,
    CHAIRMAN,
    CHAIRMAN,
    2,
    'i64',
  ) as IContributorRow[]
  const row = rows[0]
  if (!row) {
    throw new Error(`Contributor ${CHAIRMAN} не найден — сначала запусти phase 04`)
  }
  if (row.status === 'active') {
    log(`УХД-договор ${CHAIRMAN} уже active — пропуск`)
    return
  }
  if (!row.contributor_hash) {
    throw new Error(`У ${CHAIRMAN} нет contributor_hash в строке ${JSON.stringify(row)}`)
  }

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

  // Ждём пока parser положит approval в pg + добываем оригинальный document
  // (signedDocument с ant'овой подписью id=1).
  let approvalDoc: ISignedDocument | null = null
  for (let attempt = 1; attempt <= 8; attempt++) {
    await new Promise(r => setTimeout(r, attempt === 1 ? 1500 : 2000))
    log(`fetch chairman_approvals.document (approval_hash=${row.contributor_hash.slice(0, 10)}...) attempt=${attempt}`)
    approvalDoc = await fetchApprovalDocument(row.contributor_hash)
    if (approvalDoc) break
    log('approval ещё не в pg — ждём parser...')
  }
  if (!approvalDoc) {
    throw new Error(`approval с hash=${row.contributor_hash} не появился в chairman_approvals за 15s`)
  }

  // Председатель добавляет ВТОРУЮ подпись к тому же документу — ровно как
  // делает desktop ConfirmApproval.useSignDocument с signatureId=2.
  log(`подписываю document второй подписью (signatureId=2) от имени ${CHAIRMAN}`)
  const generated = {
    hash: approvalDoc.doc_hash,
    meta: approvalDoc.meta,
  }
  const signedTwice = await client.Document.signDocument(
    generated as Parameters<typeof client.Document.signDocument>[0],
    CHAIRMAN,
    2,
    [approvalDoc] as Parameters<typeof client.Document.signDocument>[3],
  )
  // controller'ский resolver ждёт meta как string в SignedDigitalDocumentInput.
  const approvedDocumentForApi = {
    ...signedTwice,
    meta: typeof signedTwice.meta === 'string'
      ? signedTwice.meta
      : JSON.stringify(signedTwice.meta ?? {}),
  }

  log(`chairmanConfirmApprove (approval_hash=${row.contributor_hash.slice(0, 10)}..., signatures=${approvedDocumentForApi.signatures.length})`)
  await client.Mutation(Mutations.Chairman.ConfirmApprove.mutation, {
    variables: {
      data: {
        coopname: COOPNAME,
        approval_hash: row.contributor_hash.toLowerCase(),
        approved_document: approvedDocumentForApi,
      },
    } as Mutations.Chairman.ConfirmApprove.IInput,
  })

  log(`фаза 04b завершена — УХД-договор ${CHAIRMAN} активен`)
}
