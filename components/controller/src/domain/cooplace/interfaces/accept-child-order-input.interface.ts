import type { Interfaces } from 'cooptypes';

export type AcceptChildOrderInputDomainInterface = Omit<Interfaces.Marketplace.IAccept, 'convert_out' | 'return_document'> & {
  convert_out: { meta: any; [key: string]: any };
  return_document: { meta: any; [key: string]: any };
};
