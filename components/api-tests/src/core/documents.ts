/**
 * Подпись документов ключом пайщика — тем же классом SDK, что у рабочего
 * стола. Первая подпись — id=1; вторая подпись поверх чужой (двухподписные
 * акты) — id=2 с агрегатом документа.
 */
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
