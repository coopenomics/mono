import type { Interfaces } from 'cooptypes';

export type AcceptChildOrderInputDomainInterface = Omit<Interfaces.Marketplace.IAccept, 'convert_out' | 'return_document'> & {
  convert_out: Interfaces.Marketplace.IDocument2;
  return_document: Interfaces.Marketplace.IDocument2;
};
