import type { IDocument } from '../../common'

export namespace RequestReturn {
  export const actionName = 'requestreturn'

  export interface IRequestReturn {
    coopname: string
    username: string
    request_hash: string
    return_statement: IDocument
  }
}
