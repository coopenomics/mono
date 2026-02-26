import type { Interfaces } from 'cooptypes';

export type ReceiveOnRequestInputDomainInterface = Omit<Interfaces.Marketplace.IReceive, 'document'> & {
  document: { meta: any; [key: string]: any };
};
