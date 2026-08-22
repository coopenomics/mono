import type { Cooperative } from 'cooptypes';
import type { GeneratedDocumentDomainInterface } from '@coopenomics/extension-kit';

export class DocumentDomainEntity implements GeneratedDocumentDomainInterface {
  full_title: string;
  html: string;
  hash: string;
  meta: Cooperative.Document.IMetaDocument & { [key: string]: any };
  binary: string; // Хранится как строка (Base64)

  constructor(data: Cooperative.Document.IGeneratedDocument) {
    if (!data) throw new Error('Document data is required');
    this.full_title = data.full_title;
    this.html = data.html;
    this.hash = data.hash;
    this.meta = data.meta;
    this.binary = Buffer.from(data.binary.buffer).toString('base64');
  }
}
