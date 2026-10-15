import { Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'
import { RegistrySource } from 'src/shared/lib/registry-source'
import type {
  IProcessGetInput,
  IProcessListInput,
  IProcessListResult,
  IProcessSnapshot,
  IProcessView,
} from '../types'

async function getProcess(
  input: IProcessGetInput,
  source: RegistrySource = RegistrySource.CORE,
): Promise<IProcessView | undefined> {
  if (source === RegistrySource.ACCOUNTANT) {
    const { [Queries.Reports.ReportsProcess.name]: view } = await client.Query(
      Queries.Reports.ReportsProcess.query,
      { variables: input },
    )
    return view
  }
  const { [Queries.Processes.GetProcess.name]: output } = await client.Query(
    Queries.Processes.GetProcess.query,
    { variables: input },
  )
  return output
}

async function listProcesses(
  input: IProcessListInput,
  source: RegistrySource = RegistrySource.CORE,
): Promise<IProcessListResult | undefined> {
  if (source === RegistrySource.ACCOUNTANT) {
    const { [Queries.Reports.ReportsProcesses.name]: page } = await client.Query(
      Queries.Reports.ReportsProcesses.query,
      { variables: input },
    )
    return page
  }
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
