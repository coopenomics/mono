import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { InnerAssignableRole, IRoleAssignmentsPort } from '@coopenomics/innercoop';
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
export class RoleAssignmentsRegistry implements IRoleAssignmentsPort {
  private readonly declared = new Map<string, DeclaredRole>();

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

  list(): DeclaredRole[] {
    return [...this.declared.values()];
  }

  find(key: string): DeclaredRole | undefined {
    return this.declared.get(key);
  }

  async rolesOf(extensionName: string, username: string): Promise<string[]> {
    const own = this.list().filter((role) => role.extensionName === extensionName);
    if (own.length === 0) return [];
    const keys = new Set(own.map((role) => role.key));
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
