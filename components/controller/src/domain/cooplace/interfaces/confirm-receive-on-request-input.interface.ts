import type { Interfaces } from 'cooptypes';

export type ConfirmReceiveOnRequestInputDomainInterface = Omit<Interfaces.Marketplace.IReceivecnf, 'document'> & {
  document: { meta: any; [key: string]: any };
};
