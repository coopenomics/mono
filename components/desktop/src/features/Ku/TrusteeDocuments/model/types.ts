import type { Mutations, Queries } from '@coopenomics/sdk';

export type IKuTrusteeDocumentsInput = Queries.Ku.GetTrusteeDocuments.IInput['data'];
export type IKuTrusteeDocuments = Queries.Ku.GetTrusteeDocuments.IOutput[typeof Queries.Ku.GetTrusteeDocuments.name];
export type IKuPowerOfAttorney = NonNullable<IKuTrusteeDocuments['authority']>;
export type IGenerateKuTrusteePowerOfAttorneyInput = Mutations.Ku.GenerateTrusteePowerOfAttorney.IInput['data'];
export type ISignKuTrusteeAuthorityInput = Mutations.Ku.SignTrusteeAuthority.IInput['data'];
export type ISignKuTrusteeLiabilityInput = Mutations.Ku.SignTrusteeLiability.IInput['data'];
