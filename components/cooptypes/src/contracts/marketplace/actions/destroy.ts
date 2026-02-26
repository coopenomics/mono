import type { IDocument } from '../../common'

export namespace Destroy {
  export const actionName = 'destroy'

  export interface IDestroy {
    coopname: string
    request_hash: string
    destruction_act: IDocument
  }
}
