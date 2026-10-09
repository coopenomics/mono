import type { Mutations, Queries } from '@coopenomics/sdk';

export type IAssignableRole = Queries.AccessRoles.GetAssignableRoles.IOutput[typeof Queries.AccessRoles.GetAssignableRoles.name][number];
export type IRoleAssignment = IAssignableRole['assignments'][number];
export type IRoleAssignmentInput = Mutations.AccessRoles.AssignRole.IInput['data'];
