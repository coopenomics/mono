import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type {
  IGenerateKuTrusteePowerOfAttorneyInput,
  IKuTrusteeDocumentsInput,
  ISignKuTrusteeAuthorityInput,
  ISignKuTrusteeLiabilityInput,
} from '../model/types';

async function getTrusteeDocuments(data: IKuTrusteeDocumentsInput) {
  const { [Queries.Ku.GetTrusteeDocuments.name]: result } = await client.Query(Queries.Ku.GetTrusteeDocuments.query, {
    variables: { data },
  });
  return result;
}

async function generateTrusteePowerOfAttorney(data: IGenerateKuTrusteePowerOfAttorneyInput) {
  const { [Mutations.Ku.GenerateTrusteePowerOfAttorney.name]: result } = await client.Mutation(
    Mutations.Ku.GenerateTrusteePowerOfAttorney.mutation,
    { variables: { data } },
  );
  return result;
}

async function signTrusteeAuthority(data: ISignKuTrusteeAuthorityInput) {
  const { [Mutations.Ku.SignTrusteeAuthority.name]: result } = await client.Mutation(
    Mutations.Ku.SignTrusteeAuthority.mutation,
    { variables: { data } },
  );
  return result;
}

async function signTrusteeLiability(data: ISignKuTrusteeLiabilityInput) {
  const { [Mutations.Ku.SignTrusteeLiability.name]: result } = await client.Mutation(
    Mutations.Ku.SignTrusteeLiability.mutation,
    { variables: { data } },
  );
  return result;
}

export const api = {
  getTrusteeDocuments,
  generateTrusteePowerOfAttorney,
  signTrusteeAuthority,
  signTrusteeLiability,
};
