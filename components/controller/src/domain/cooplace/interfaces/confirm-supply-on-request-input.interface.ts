import type { Interfaces } from 'cooptypes';

export type ConfirmSupplyOnRequestInputDomainInterface = Omit<Interfaces.Marketplace.ISupplcnf, 'act'> & {
  act: Interfaces.Marketplace.IDocument2;
};
