/**
 * Подпись документов ключом пайщика — тем же классом SDK, что у рабочего
 * стола. Первая подпись — id=1; вторая подпись поверх чужой (двухподписные
 * акты) — id=2 с агрегатом документа.
 */
import ecc from 'eosjs-ecc'
import type { Who } from './auth'
import { randomHash } from './chain'

export interface Signable { full_title?: string, html?: string, hash: string, meta: unknown, binary?: string }

export async function signDocument(wif: string, doc: unknown, account: string, id = 1, aggregates?: unknown[]): Promise<any> {
  const { Classes } = await import('@coopenomics/sdk')
  const signer: any = new Classes.Document(wif)
  return aggregates
    ? signer.signDocument(doc, account, id, aggregates)
    : signer.signDocument(doc, account, id)
}

/**
 * Мета документа. GraphQL отдаёт её скаляром JSON — объектом; прежде это была
 * строка, и наборы разбирали её JSON.parse.
 */
export function docMeta(meta: unknown): Record<string, any> {
  return typeof meta === 'string' ? JSON.parse(meta) : (meta as Record<string, any>)
}

// ── Документы в формате цепи ───────────────────────────────────────────────

function signatures(hash: string, signers: Who[]) {
  const signedAt = new Date().toISOString().slice(0, 19)
  return signers.map((s, i) => ({
    id: i + 1,
    signed_hash: hash,
    signer: s.account,
    public_key: ecc.privateToPublic(s.wif),
    signature: ecc.signHash(hash, s.wif),
    signed_at: signedAt,
    meta: '{}',
  }))
}

/**
 * Документ в формате цепи, подписанный ключами участников. Контракт сверяет
 * подпись с ключом аккаунта подписанта — чужим ключом его не подписать.
 */
export function chainDoc(signers: Who[], hash = randomHash()) {
  return { version: '1.0.0', hash, doc_hash: hash, meta_hash: hash, meta: '{}', signatures: signatures(hash, signers) }
}

/** Тот же документ в формате входа GraphQL (мета — объект). */
export function apiDoc(signers: Who[], hash = randomHash()) {
  return { version: '1.0.0', hash, doc_hash: hash, meta_hash: hash, meta: {}, signatures: signatures(hash, signers) }
}

/** Подписанный SDK документ — в цепь (мета строкой). */
export function toChainDoc(signed: any) {
  return { ...signed, meta: typeof signed.meta === 'string' ? signed.meta : JSON.stringify(signed.meta ?? {}) }
}
