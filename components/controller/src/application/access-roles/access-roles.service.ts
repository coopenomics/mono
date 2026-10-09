import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import { NOTIFICATION_PORT, type INotificationPort } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { ExtensionListingInteractor } from '~/application/appstore/interactors/extension-listing.interactor';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ACCOUNT_DATA_PORT, type AccountDataPort } from '~/domain/account/ports/account-data.port';
import {
  ROLE_ASSIGNMENT_REPOSITORY,
  type RoleAssignmentData,
  type RoleAssignmentRepository,
} from '~/domain/access-roles/role-assignment.repository';
import { USER_REPOSITORY, type UserRepository } from '~/domain/user/repositories/user.repository';
import { AppRegistry } from '~/extensions/extensions.registry';
import { RolePermissionAccess, type AssignableRoleDTO, type RoleAssignmentDTO } from './dto/assignable-role.dto';
import type { RoleAssignmentInputDTO } from './dto/role-assignment-input.dto';
import { RoleAssignmentsRegistry, type DeclaredRole } from './role-assignments.registry';

/**
 * Управление доступом (C28-90): какие роли объявили приложения, кому они
 * назначены, назначение и снятие. Что роль разрешает, сервис не знает — это
 * записано в таблице прав приложения, которое роль объявило.
 */
@Injectable()
export class AccessRolesService {
  constructor(
    private readonly registry: RoleAssignmentsRegistry,
    private readonly extensions: ExtensionListingInteractor,
    @Inject(ROLE_ASSIGNMENT_REPOSITORY) private readonly assignments: RoleAssignmentRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ACCOUNT_DATA_PORT) private readonly accounts: AccountDataPort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(AccessRolesService.name);
  }

  /** Роли установленных приложений с пайщиками, которым они назначены. */
  async list(): Promise<AssignableRoleDTO[]> {
    const [active, installed] = await Promise.all([this.assignments.findActive(config.coopname), this.installedApps()]);
    const roles = this.registry.list().filter((role) => installed.has(role.extensionName));
    return Promise.all(roles.map((role) => this.present(role, active)));
  }

  /** Приложения кооператива: роль неустановленного приложения не показывается и не назначается. */
  private async installedApps(): Promise<Set<string>> {
    const apps = await this.extensions.getCombinedAppList({ is_installed: true, is_available: true, enabled: true });
    return new Set(apps.map((app) => app.name));
  }

  /** Назначить роль пайщику. Повторное назначение ничего не меняет. */
  async assign(actor: string, data: RoleAssignmentInputDTO): Promise<AssignableRoleDTO> {
    const role = this.declared(data.role);
    if (!(await this.installedApps()).has(role.extensionName)) {
      throw DomainError.notFound('ACCESS_ROLE_UNKNOWN', { role: data.role });
    }
    const user = await this.users.findByUsername(data.username);
    if (!user?.isActive()) {
      throw DomainError.unprocessable('ACCESS_ROLE_PARTICIPANT_REQUIRED', { username: data.username });
    }
    const assigned = await this.assignments.assign({
      coopname: config.coopname,
      username: data.username,
      extension_name: role.extensionName,
      role: role.key,
      assigned_by: actor,
    });
    if (assigned) await this.notify(Workflows.AccessRoleAssigned.id, role, data.username);
    return this.present(role, await this.assignments.findActive(config.coopname));
  }

  /** Снять роль с пайщика. Снятие роли, которой у пайщика нет, ничего не меняет. */
  async revoke(actor: string, data: RoleAssignmentInputDTO): Promise<AssignableRoleDTO> {
    const role = this.declared(data.role);
    const revoked = await this.assignments.revoke(config.coopname, data.username, role.key, actor);
    if (revoked) await this.notify(Workflows.AccessRoleRevoked.id, role, data.username);
    return this.present(role, await this.assignments.findActive(config.coopname));
  }

  private declared(key: string): DeclaredRole {
    const role = this.registry.find(key);
    if (!role) throw DomainError.notFound('ACCESS_ROLE_UNKNOWN', { role: key });
    return role;
  }

  private appTitle(extensionName: string): string {
    return AppRegistry[extensionName]?.title ?? extensionName;
  }

  private async present(role: DeclaredRole, active: RoleAssignmentData[]): Promise<AssignableRoleDTO> {
    const holders = active.filter((row) => row.role === role.key);
    const assignments: RoleAssignmentDTO[] = await Promise.all(
      holders.map(async (row) => ({
        username: row.username,
        display_name: await this.displayName(row.username),
        assigned_by: row.assigned_by,
        assigned_at: row.assigned_at,
      }))
    );
    return {
      key: role.key,
      title: role.title,
      description: role.description,
      extension_name: role.extensionName,
      extension_title: this.appTitle(role.extensionName),
      permissions: role.permissions.map((permission) => ({
        title: permission.title,
        access: permission.access === 'write' ? RolePermissionAccess.WRITE : RolePermissionAccess.READ,
      })),
      assignments,
    };
  }

  /** Имя пайщика; учётная запись без данных показывается учётным именем. */
  private async displayName(username: string): Promise<string> {
    try {
      return (await this.accounts.getDisplayName(username)) || username;
    } catch {
      return username;
    }
  }

  /** Сообщить пайщику о роли. Доставка назначение не держит: отказ уходит в журнал. */
  private async notify(workflowId: string, role: DeclaredRole, username: string): Promise<void> {
    try {
      const user = await this.users.findByUsername(username);
      const subscriberId = user?.subscriber_id?.trim();
      if (!user || !subscriberId) return;
      const payload: Workflows.AccessRoleAssigned.IPayload = {
        roleTitle: role.title,
        roleDescription: role.description,
        appTitle: this.appTitle(role.extensionName),
      };
      await this.notifications.notify({
        coopname: config.coopname,
        workflowId,
        to: { subscriberId, email: user.email, username },
        payload,
      });
    } catch (error) {
      this.logger.error(`Уведомление о роли «${role.key}» пайщику ${username} не отправлено: ${(error as Error).message}`);
    }
  }
}
