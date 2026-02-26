import type { IDocument } from '../../common'

export namespace AcceptStock {
  export const actionName = 'acceptstock'

  export interface IAcceptStock {
    coopname: string
    username: string
    request_hash: string
    convert_in: IDocument
    return_statement: IDocument
  }
}
