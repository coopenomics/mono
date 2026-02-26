import type { Interfaces } from 'cooptypes';

export type CreateChildOrderInputDomainInterface = Omit<Interfaces.Marketplace.ICreateorder, 'convert_in'> & {
  convert_in: Interfaces.Marketplace.IDocument2;
};
