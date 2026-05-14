import type { Mutations, Zeus } from '@coopenomics/sdk'
import type { IDocument } from 'src/shared/lib/types/document'

export type IGeneratedRegistrationDocument =
  Mutations.Registration.GenerateRegistrationDocuments.IOutput[
    typeof Mutations.Registration.GenerateRegistrationDocuments.name
  ]['documents'][number]

export interface ISigningDocument extends IGeneratedRegistrationDocument {
  signed_document?: IDocument
  accepted?: boolean
}

export interface IDocumentSigningOptions {
  coopname: string
  username: string
  accountType: Zeus.AccountType
  programKey?: string
}
