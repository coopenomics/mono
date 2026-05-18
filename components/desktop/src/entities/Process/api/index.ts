import { Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'
import type {
  IProcessGetInput,
  IProcessListInput,
  IProcessListResult,
  IProcessSnapshot,
  IProcessView,
} from '../types'

async function getProcess(input: IProcessGetInput): Promise<IProcessView | undefined> {
  const { [Queries.Processes.GetProcess.name]: output } = await client.Query(
    Queries.Processes.GetProcess.query,
    { variables: input },
  )
  return output
}

async function listProcesses(input: IProcessListInput): Promise<IProcessListResult | undefined> {
  const { [Queries.Processes.ListProcesses.name]: output } = await client.Query(
    Queries.Processes.ListProcesses.query,
    { variables: input },
  )
  return output
}

/**
 * Текущий snapshot процесса = последний delta_history по block_num. На
 * stale-данных или fresh-процессе массив может быть пустым — возвращаем null,
 * чтобы прикладной слой не делал ни проверок длины, ни приведений.
 */
function pickLatestSnapshot(view: IProcessView | undefined): IProcessSnapshot | null {
  const deltas = view?.delta_history ?? []
  if (!deltas.length) return null
  const latest = [...deltas].sort((a, b) => a.block_num - b.block_num).at(-1)
  const raw = latest?.value
  return (raw && typeof raw === 'object' ? (raw as IProcessSnapshot) : null)
}

export const processApi = {
  getProcess,
  listProcesses,
  pickLatestSnapshot,
}
