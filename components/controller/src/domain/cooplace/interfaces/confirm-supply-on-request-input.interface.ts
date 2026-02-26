import type { Interfaces } from 'cooptypes';

export type ConfirmSupplyOnRequestInputDomainInterface = Omit<Interfaces.Marketplace.ISupplcnf, 'act'> & {
  act: { meta: any; [key: string]: any };
};
