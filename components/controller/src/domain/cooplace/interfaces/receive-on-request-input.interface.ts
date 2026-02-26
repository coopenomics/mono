import type { Interfaces } from 'cooptypes';

export type ReceiveOnRequestInputDomainInterface = Omit<Interfaces.Marketplace.IReceive, 'document'> & {
  document: Interfaces.Marketplace.IDocument2;
};
