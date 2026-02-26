import type { Interfaces } from 'cooptypes';

export type SupplyOnRequestInputDomainInterface = Omit<Interfaces.Marketplace.ISupply, 'act'> & {
  act: { meta: any; [key: string]: any };
};
