import type { IDocument } from '../../common'

export namespace ReqReturn {
  export const actionName = 'reqreturn'

  export interface IReqReturn {
    coopname: string
    username: string
    request_hash: string
    return_statement: IDocument
  }
}
