import { Global, Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import type { InnerAssignableRole, InnerAttachedRole, InnerRolePermission, IRoleAssignmentsPort } from '@coopenomics/innercoop';
import config from '~/config/config';
import {
  ROLE_ASSIGNMENT_REPOSITORY,
  type RoleAssignmentRepository,
} from '~/domain/access-roles/role-assignment.repository';

/**
 * Роли узла: их даёт состав совета и статус пайщика, назначить их нельзя.
 * Приложение с ролью под таким ключом выдало бы её держателю права совета
 * или председателя, поэтому объявление останавливает запуск.
 */
export const NODE_ROLE_KEYS: ReadonlySet<string> = new Set(['account', 'participant', 'council', 'chairman', 'user', 'member']);

/** Объявленная роль: что о ней сказало приложение. */
export interface DeclaredRole extends InnerAssignableRole {
  extensionName: string;
}

/** Дополнение к роли: полномочия, которые ей даёт приложение `extensionName` по своей таблице. */
export interface RoleAttachment {
  extensionName: string;
  permissions: readonly InnerRolePermission[];
}

/**
 * Реестр назначаемых ролей (C28-90).
 *
 * Роли объявляют приложения при запуске; ядро своих ролей здесь не заводит и
 * прав роли не знает — они записаны в таблице прав приложения. Реестр отвечает
 * на два вопроса: какие роли есть в кооперативе и какие из них назначены
 * пайщику.
 *
 * Ключ роли уникален среди всех приложений: повтор останавливает запуск узла,
 * иначе назначение одной роли открыло бы пайщику права другой.
 */
@Injectable()
export class RoleAssignmentsRegistry implements IRoleAssignmentsPort, OnApplicationBootstrap {
  private readonly declared = new Map<string, DeclaredRole>();
  /** Роль → приложения, которые присоединили к ней свои полномочия. */
  private readonly attached = new Map<string, RoleAttachment[]>();

  constructor(@Inject(ROLE_ASSIGNMENT_REPOSITORY) private readonly assignments: RoleAssignmentRepository) {}

  declare(extensionName: string, roles: readonly InnerAssignableRole[]): void {
    for (const role of roles) {
      if (NODE_ROLE_KEYS.has(role.key)) {
        // i18n-ignore: ошибка разработчика — узел не запускается, пайщик этот текст не видит
        throw new Error(`Ключ «${role.key}» занят ролью узла: приложение «${extensionName}» объявить его назначаемой ролью не может`);
      }
      const known = this.declared.get(role.key);
      if (known) {
        // i18n-ignore: ошибка разработчика — узел не запускается, пайщик этот текст не видит
        throw new Error(`Ключ назначаемой роли «${role.key}» объявлен дважды: приложениями «${known.extensionName}» и «${extensionName}»`);
      }
      this.declared.set(role.key, { ...role, extensionName });
    }
  }

  attach(extensionName: string, roles: readonly InnerAttachedRole[]): void {
    for (const role of roles) {
      const known = this.attached.get(role.key) ?? [];
      this.attached.set(role.key, [...known, { extensionName, permissions: role.permissions }]);
    }
  }

  /**
   * Приложения запускаются в произвольном порядке, поэтому присоединения
   * сверяются с объявлениями, когда объявили все: роль, которую никто не
   * объявил, или дополнение собственной роли останавливают запуск.
   */
  onApplicationBootstrap(): void {
    for (const [key, attachments] of this.attached) {
      const role = this.declared.get(key);
      for (const attachment of attachments) {
        if (!role || role.extensionName === attachment.extensionName) {
          // i18n-ignore: ошибка разработчика — узел не запускается, пайщик этот текст не видит
          throw new Error(`Приложение «${attachment.extensionName}» дополняет роль «${key}», которую не объявило другое приложение`);
        }
      }
    }
  }

  /** Дополнения роли от других приложений. */
  attachmentsOf(key: string): RoleAttachment[] {
    return this.attached.get(key) ?? [];
  }

  list(): DeclaredRole[] {
    return [...this.declared.values()];
  }

  find(key: string): DeclaredRole | undefined {
    return this.declared.get(key);
  }

  async holdersOf(extensionName: string, role: string): Promise<string[]> {
    if (this.declared.get(role)?.extensionName !== extensionName) return [];
    const active = await this.assignments.findActive(config.coopname);
    return active.filter((row) => row.role === role).map((row) => row.username);
  }

  async rolesOf(extensionName: string, username: string): Promise<string[]> {
    const keys = new Set(this.list().filter((role) => role.extensionName === extensionName).map((role) => role.key));
    for (const [key, attachments] of this.attached) {
      if (this.declared.has(key) && attachments.some((attachment) => attachment.extensionName === extensionName)) keys.add(key);
    }
    if (keys.size === 0) return [];
    const active = await this.assignments.findActiveByUser(config.coopname, username);
    return active.filter((row) => keys.has(row.role)).map((row) => row.role);
  }
}

@Global()
@Module({
  providers: [RoleAssignmentsRegistry],
  exports: [RoleAssignmentsRegistry],
})
export class RoleAssignmentsRegistryModule {}
