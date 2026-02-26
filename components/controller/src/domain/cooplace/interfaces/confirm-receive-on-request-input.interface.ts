import type { Interfaces } from 'cooptypes';

export type ConfirmReceiveOnRequestInputDomainInterface = Omit<Interfaces.Marketplace.IReceivecnf, 'document'> & {
  document: Interfaces.Marketplace.IDocument2;
};
