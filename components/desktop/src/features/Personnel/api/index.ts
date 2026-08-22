import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type { ICapabilitySet, ICapabilitySetAssignment } from '../model';

// auth-v2 (CoopID) теперь через @coopenomics/sdk (Zeus) — никакого прямого REST с фронта.
async function getCapabilitySets(): Promise<ICapabilitySet[]> {
  const { [Queries.Authorization.GetCapabilitySets.name]: result } = await client.Query(
    Queries.Authorization.GetCapabilitySets.query,
  );
  return result;
}

async function getParticipantSets(username: string): Promise<ICapabilitySetAssignment[]> {
  const { [Queries.Authorization.GetParticipantCapabilitySets.name]: result } = await client.Query(
    Queries.Authorization.GetParticipantCapabilitySets.query,
    { variables: { username } },
  );
  return result;
}

async function assignSet(data: Mutations.Authorization.AssignCapabilitySet.IInput['data']): Promise<void> {
  await client.Mutation(Mutations.Authorization.AssignCapabilitySet.mutation, { variables: { data } });
}

async function revokeSet(data: Mutations.Authorization.RevokeCapabilitySet.IInput['data']): Promise<void> {
  await client.Mutation(Mutations.Authorization.RevokeCapabilitySet.mutation, { variables: { data } });
}

export const api = { getCapabilitySets, getParticipantSets, assignSet, revokeSet };
