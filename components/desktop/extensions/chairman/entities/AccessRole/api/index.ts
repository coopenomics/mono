import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type { IAssignableRole, IRoleAssignmentInput } from '../model';

async function loadAssignableRoles(): Promise<IAssignableRole[]> {
  const { [Queries.AccessRoles.GetAssignableRoles.name]: output } = await client.Query(
    Queries.AccessRoles.GetAssignableRoles.query,
  );
  return output;
}

async function assignRole(data: IRoleAssignmentInput): Promise<IAssignableRole> {
  const { [Mutations.AccessRoles.AssignRole.name]: output } = await client.Mutation(
    Mutations.AccessRoles.AssignRole.mutation,
    { variables: { data } },
  );
  return output;
}

async function revokeRole(data: IRoleAssignmentInput): Promise<IAssignableRole> {
  const { [Mutations.AccessRoles.RevokeRole.name]: output } = await client.Mutation(
    Mutations.AccessRoles.RevokeRole.mutation,
    { variables: { data } },
  );
  return output;
}

export const api = { loadAssignableRoles, assignRole, revokeRole };
