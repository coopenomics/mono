/**
 * Чтение ИМЕНИ НИТКИ процесса, с которым проводка ушла на цепь.
 *
 * В DTO журнала (`Ledger2Operation`) поля `process_type` нет — там только код
 * операции и хэш нитки. Имя лежит в сырых данных действия `ledger2::apply`,
 * поэтому берётся из реестра процессов: `process(hash, coopname){ actions{ data } }`.
 *
 * Это единственный способ ответить на вопрос ledger2.process-naming — под чьим
 * именем идёт инлайн-вызов чужого контракта: имя нитки называет инициатор, а
 * не реестр кода операции, и одна и та же операция в разных процессах идёт под
 * разными именами.
 */
import { gql, loginAsChairman } from './apiClient'

const PROCESS_QUERY = `query($h:String!,$c:String!){
  process(hash:$h, coopname:$c){ process_type actions{ name data } }
}`

export interface ProcessNaming {
  /** Имя нитки, отданное реестром процессов для этого хэша. */
  processType: string
  /** operation_code → process_type по сырым данным каждого apply. */
  byOperation: Record<string, string>
}

export async function readProcessNaming(processHash: string, coopname: string): Promise<ProcessNaming> {
  const { token } = await loginAsChairman()
  const d: any = await gql(token, PROCESS_QUERY, { h: processHash.toLowerCase(), c: coopname })

  const byOperation: Record<string, string> = {}
  for (const a of (d.process?.actions ?? [])) {
    if (a.name !== 'apply') continue
    const data = typeof a.data === 'string' ? JSON.parse(a.data) : a.data
    if (data?.operation_code) byOperation[data.operation_code] = data.process_type
  }

  return { processType: d.process?.process_type, byOperation }
}

/**
 * Дождаться, пока нитка появится в реестре процессов: parser2 отстаёт от head
 * на пару блоков, а реестр наполняется уже из его дельт.
 */
export async function waitForProcessNaming(
  processHash: string,
  coopname: string,
  expectedCodes: string[],
  timeoutMs = 90_000,
): Promise<ProcessNaming> {
  const deadline = Date.now() + timeoutMs
  let last: ProcessNaming | null = null
  while (Date.now() < deadline) {
    last = await readProcessNaming(processHash, coopname).catch(() => null)
    if (last && expectedCodes.every(c => last!.byOperation[c])) return last
    await new Promise(r => setTimeout(r, 1500))
  }
  throw new Error(
    `нитка ${processHash}: за ${timeoutMs} мс не дождались проводок [${expectedCodes.join(', ')}]; `
    + `пришли [${Object.keys(last?.byOperation ?? {}).join(', ') || '—'}]`,
  )
}
