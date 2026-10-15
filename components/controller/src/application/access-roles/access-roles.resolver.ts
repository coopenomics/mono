import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, GqlJwtAuthGuard, RequireRight, RightsGuard } from '@coopenomics/extension-kit';
import { AccessRolesService } from './access-roles.service';
import { AssignableRoleDTO } from './dto/assignable-role.dto';
import { RoleAssignmentInputDTO } from './dto/role-assignment-input.dto';

@Resolver()
@UseGuards(GqlJwtAuthGuard, RightsGuard)
export class AccessRolesResolver {
  constructor(private readonly accessRoles: AccessRolesService) {}

  @Query(() => [AssignableRoleDTO], {
    name: 'getAssignableRoles',
    description: 'Роли приложений кооператива и пайщики, которым они назначены',
  })
  @RequireRight('AccessRole', 'manage')
  getAssignableRoles(): Promise<AssignableRoleDTO[]> {
    return this.accessRoles.list();
  }

  @Mutation(() => AssignableRoleDTO, { name: 'assignRole', description: 'Назначить роль пайщику' })
  @RequireRight('AccessRole', 'manage')
  assignRole(
    @Args('data', { type: () => RoleAssignmentInputDTO }) data: RoleAssignmentInputDTO,
    @CurrentUser() user: { username: string }
  ): Promise<AssignableRoleDTO> {
    return this.accessRoles.assign(user.username, data);
  }

  @Mutation(() => AssignableRoleDTO, { name: 'revokeRole', description: 'Снять роль с пайщика' })
  @RequireRight('AccessRole', 'manage')
  revokeRole(
    @Args('data', { type: () => RoleAssignmentInputDTO }) data: RoleAssignmentInputDTO,
    @CurrentUser() user: { username: string }
  ): Promise<AssignableRoleDTO> {
    return this.accessRoles.revoke(user.username, data);
  }
}
