import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '@coopenomics/docs-templates'

export interface ITable {
  chain_id: string
  block_num: number
  block_id: string
  present: string
  code: string
  scope: string
  table: string
  primary_key: string
  value?: any
}

export interface IAction<T = any> {
  transaction_id: string
  account: string
  block_num: number
  block_id: string
  chain_id: string
  name: string
  receiver: string
  authorization: Array<{
    actor: string
    permission: string
  }>
  data: T
  action_ordinal: number
  global_sequence: string
  account_ram_deltas: Array<{
    account: string
    delta: number
  }>
  console: string
  receipt: {
    receiver: string
    act_digest: string
    global_sequence: string
    recv_sequence: string
    auth_sequence: Array<{
      account: string
      sequence: string
    }>
    code_sequence: number
    abi_sequence: number
  }
  creator_action_ordinal: number
  context_free: boolean
  elapsed: number
}

export interface IExtendedTable extends ITable {

}

export interface IExtendedAction extends IAction {
  user?: IIndividualData | IEntrepreneurData | IOrganizationData | null
}

export interface IGetActions {
  results: IAction[]
  page: number
  limit: number
  total: number
}

export interface IGetTables {
  results: ITable[]
  page: number
  limit: number
  total: number
}
