/**
 * Диагностика ЗАКРЫВАЮЩЕЙ подписи АПП председателем КУ вне UI (шаг 7
 * магистрали II) по КАНОНУ двухподписного документа (как приём РИД в
 * Capital). Воспроизводит КЛИЕНТСКУЮ цепочку фронтенда:
 *
 *   1. query marketplaceAplReceptionChairmanSignablePayloads → backend отдаёт
 *      DocumentAggregate на каждый Order: rawDocument (исходный документ для
 *      ознакомления, оригинальный порядок meta) + document (подписанный
 *      поставщиком, с его подписью).
 *   2. signDocument(rawDocument, chairman, 2, [document]) — председатель
 *      накладывает свою подпись (id=2) поверх подписи поставщика (id=1).
 *   3. mutation marketplaceSignAplReceptionAsChairman → backend signchair с
 *      документом, где ОБЕ подписи.
 *
 * ФРОНТ ЦЕПЬ НЕ ЧИТАЕТ — всё отдаёт backend. (Раньше тут было чтение
 * order.acceptance_act_signsupp из get_table_rows — это антипаттерн, см.
 * memory reference_2sig_canon_marketplace_capital; on-chain meta-строка к
 * тому же переупорядочена и для re-sign непригодна.)
 *
 * Запуск (mono-ai-4):
 *   API_URL=http://127.0.0.1:3028/v1/graphql CHAIN_URL=http://127.0.0.1:8918 \
 *   SERVER_SECRET=SECRET APL_ID=<свежий-апп-после-skip_save:false> \
 *     pnpm --filter @coopenomics/boot exec esno src/scripts/diag-sign-apl-chairman.ts
 */
import ecc from 'eosjs-ecc'
import { Classes } from '@coopenomics/sdk'

const API_URL = process.env.API_URL || 'http://127.0.0.1:3028/v1/graphql'
const CHAIN_URL = process.env.CHAIN_URL || 'http://127.0.0.1:8918'
const SERVER_SECRET = process.env.SERVER_SECRET || 'SECRET'
const APL_ID = process.env.APL_ID || ''
const EMAIL = process.env.EMAIL || 'chairkrg@voskhod.coop'
const WIF = process.env.WIF || '5KN4NRRdqNG9SH7sLP9pA87zvRSWmCR3a43mTHXbi7SwDTietBL'
const ACCOUNT = process.env.ACCOUNT || 'chairkrg'

async function gqlRaw(token: string | null, query: string, variables?: any): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  else headers['server-secret'] = SERVER_SECRET
  const res = await fetch(API_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  const payload: any = await res.json()
  if (payload.errors) throw new Error('gql: ' + JSON.stringify(payload.errors))
  return payload.data
}

async function main() {
  if (!APL_ID) throw new Error('APL_ID обязателен (свежий АПП, подписанный поставщиком после skip_save:false)')

  // 1. login as chairman
  const info = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  const now = info.head_block_time
  const digest = ecc.sha256(Buffer.from(now, 'utf8'), 'hex')
  const signature = ecc.signHash(digest, WIF)
  const loginM = `mutation($d:LoginInput!){ login(data:$d){ tokens{ access{ token } } account{ username } } }`
  const ld = await gqlRaw(null, loginM, { d: { email: EMAIL, now, signature } })
  const token = ld.login.tokens.access.token
  console.error('[diag] logged in as', ld.login.account.username)

  // 2. backend отдаёт supplier-подписанные акты (DocumentAggregate) — без цепи
  const q = `query($d:MarketplaceAplReceptionByIdInput!){
    marketplaceAplReceptionChairmanSignablePayloads(data:$d){
      hash
      rawDocument{ full_title html hash meta binary }
      document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
    }
  }`
  const qd = await gqlRaw(token, q, { d: { apl_reception_id: APL_ID } })
  const payloads = qd.marketplaceAplReceptionChairmanSignablePayloads as any[]
  console.error('[diag] aggregates:', payloads.length,
    'sig поставщика по 1-му:', JSON.stringify(payloads[0]?.document?.signatures?.map((s: any) => `${s.id}:${s.signer}`)))

  // 3. накладываем подпись председателя (id=2) поверх подписи поставщика (id=1)
  const signer = new Classes.Document(WIF)
  const signed_documents: any[] = []
  for (const p of payloads) {
    const signed = await signer.signDocument(p.rawDocument, ACCOUNT, 2, [p.document])
    console.error('[diag] order_id', p.rawDocument?.meta?.order_id, '→ подписей:', signed.signatures.length,
      signed.signatures.map((s: any) => `${s.id}:${s.signer}`).join(','))
    signed_documents.push(signed)
  }

  // 4. mutation — backend signchair (контракт требует обе подписи)
  const m = `mutation($d:MarketplaceSignAplReceptionInput!){ marketplaceSignAplReceptionAsChairman(data:$d){ apl_reception{ id status chairman_signed_at chairman_account chairman_signchair_tx_hash } } }`
  const md = await gqlRaw(token, m, { d: { apl_reception_id: APL_ID, signed_documents } })
  console.error('[diag] signAsChairman OK:', JSON.stringify(md.marketplaceSignAplReceptionAsChairman))
}

main().then(() => process.exit(0)).catch((e) => { console.error('[diag] FAILED:', e.message ?? e); process.exit(1) })
