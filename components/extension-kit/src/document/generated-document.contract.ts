import type { IGeneratedDocument } from '@coopenomics/docs-templates';

export type GeneratedDocumentDomainInterface = Omit<IGeneratedDocument, 'binary'> & {
  binary: string;
};
