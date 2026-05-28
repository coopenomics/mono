/**
 * Диагностика подписи АПП поставщиком вне UI: воспроизводит клиентскую
 * цепочку (query payloads → Classes.Document.signDocument → mutation
 * signAsSupplier) от лица ivanpetrov, чтобы изолировать backend/подпись
 * от проблем desktop (globalStore.wif / клик по диалогу).
 *
 * Запуск (mono-ai-4):
 *   API_URL=http://127.0.0.1:3028/v1/graphql CHAIN_URL=http://127.0.0.1:8918 \
 *   SERVER_SECRET=SECRET APL_ID=8d7cf06c-7c9d-4e05-86c9-a41d94165c9c \
 *     pnpm --filter @coopenomics/boot exec esno src/scripts/diag-sign-apl.ts
 */
import ecc from 'eosjs-ecc'
import { Classes } from '@coopenomics/sdk'

const API_URL = process.env.API_URL || 'http://127.0.0.1:3028/v1/graphql'
const CHAIN_URL = process.env.CHAIN_URL || 'http://127.0.0.1:8918'
const SERVER_SECRET = process.env.SERVER_SECRET || 'SECRET'
const APL_ID = process.env.APL_ID || '8d7cf06c-7c9d-4e05-86c9-a41d94165c9c'
const EMAIL = 'ivan.petrov@example.com'
const WIF = '5JL7fbB6kqsmk38zns2NMqqs5sWUojNGNhoAgE5G4fxXw5Uz733'
const ACCOUNT = 'ivanpetrov'

async function gqlRaw(token: string | null, query: string, variables?: any): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // server-secret шлём ТОЛЬКО на публичный login. На аутентифицированных
  // вызовах он бы обошёл MarketplaceMembershipGuard (return true без
  // наполнения currentMember) → @CurrentMarketplaceMember бросает 401.
  if (token) headers.Authorization = `Bearer ${token}`
  else headers['server-secret'] = SERVER_SECRET
  const res = await fetch(API_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  const payload: any = await res.json()
  if (payload.errors) throw new Error('gql: ' + JSON.stringify(payload.errors))
  return payload.data
}

async function main() {
  const info = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  const now = info.head_block_time
  const digest = ecc.sha256(Buffer.from(now, 'utf8'), 'hex')
  const signature = ecc.signHash(digest, WIF)
  const loginM = `mutation($d:LoginInput!){ login(data:$d){ tokens{ access{ token } } account{ username } } }`
  const ld = await gqlRaw(null, loginM, { d: { email: EMAIL, now, signature } })
  const token = ld.login.tokens.access.token
  console.error('[diag] logged in as', ld.login.account.username)

  const q = `query($d:MarketplaceAplReceptionByIdInput!){ marketplaceAplReceptionSupplierSignablePayloads(data:$d){ full_title hash meta binary } }`
  const qd = await gqlRaw(token, q, { d: { apl_reception_id: APL_ID } })
  const payloads = qd.marketplaceAplReceptionSupplierSignablePayloads
  console.error('[diag] payloads:', payloads.length, 'meta[0]:', JSON.stringify(payloads[0]?.meta))

  const signer = new Classes.Document(WIF)
  const signed_documents: any[] = []
  for (const p of payloads) {
    const s = await signer.signDocument(p, ACCOUNT, 1)
    signed_documents.push(s)
  }
  console.error('[diag] signed', signed_documents.length, 'docs; first signatures:', JSON.stringify(signed_documents[0]?.signatures?.length))

  const m = `mutation($d:MarketplaceSignAplReceptionInput!){ marketplaceSignAplReceptionAsSupplier(data:$d){ apl_reception{ id status supplier_signed_at } } }`
  const md = await gqlRaw(token, m, { d: { apl_reception_id: APL_ID, signed_documents } })
  console.error('[diag] signAsSupplier OK:', JSON.stringify(md.marketplaceSignAplReceptionAsSupplier))
}

main().then(() => process.exit(0)).catch((e) => { console.error('[diag] FAILED:', e.message ?? e); process.exit(1) })
