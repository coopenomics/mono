import type { Queries } from '@coopenomics/sdk'

export type IProcessView =
  Queries.Processes.GetProcess.IOutput[typeof Queries.Processes.GetProcess.name]

export type IProcessGetInput = Queries.Processes.GetProcess.IInput

export type IProcessDelta = NonNullable<IProcessView>['delta_history'][number]

export type IProcessAction = NonNullable<IProcessView>['actions'][number]

export type IProcessDocument = NonNullable<IProcessView>['documents'][number]

export type IProcessListResult =
  Queries.Processes.ListProcesses.IOutput[typeof Queries.Processes.ListProcesses.name]

export type IProcessListInput = Queries.Processes.ListProcesses.IInput

export type IProcessSummary = NonNullable<IProcessListResult>['items'][number]

/**
 * Текущий снэпшот процесса в bs-таблице расширения (marketplace::orders, …).
 * GraphQL-схема отдаёт `value: JSON`, поэтому строгое описание полей даёт
 * прикладной слой (см. info-widget'ы расширений). На уровне entity достаточно
 * generic-формы.
 */
export type IProcessSnapshot = Record<string, unknown>
