import { Module } from '@nestjs/common';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { CoreRightsModule } from '../rights/core-rights.module';
import { AccessRolesResolver } from './access-roles.resolver';
import { AccessRolesService } from './access-roles.service';

/**
 * Управление доступом (C28-90): страница председателя, на которой роли
 * приложений назначаются пайщикам. Реестр ролей и расчёт назначенных живут в
 * глобальном `RoleAssignmentsRegistryModule` — он нужен таблицам прав.
 */
@Module({
  imports: [CoreRightsModule, AccountInfrastructureModule],
  providers: [AccessRolesService, AccessRolesResolver],
})
export class AccessRolesModule {}
