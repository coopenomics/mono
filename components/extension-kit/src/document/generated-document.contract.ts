import type { Cooperative } from 'cooptypes';

export type GeneratedDocumentDomainInterface = Omit<Cooperative.Document.IGeneratedDocument, 'binary'> & {
  binary: string;
};
