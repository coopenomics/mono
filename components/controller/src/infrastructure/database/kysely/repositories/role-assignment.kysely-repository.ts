import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import { affectedCount } from '@coopenomics/extension-kit';
import type { RoleAssignmentData, RoleAssignmentRepository } from '~/domain/access-roles/role-assignment.repository';
import type { RoleAssignments } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

/** Код PostgreSQL: нарушение уникальности. */
const UNIQUE_VIOLATION = '23505';

function toDomain(row: Selectable<RoleAssignments>): RoleAssignmentData {
  return {
    id: row.id,
    coopname: row.coopname,
    username: row.username,
    extension_name: row.extension_name,
    role: row.role,
    assigned_by: row.assigned_by,
    assigned_at: row.assigned_at,
  };
}

/** Назначения ролей пайщикам (таблица `role_assignments`). */
@Injectable()
export class RoleAssignmentKyselyRepository implements RoleAssignmentRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findActiveByUser(coopname: string, username: string): Promise<RoleAssignmentData[]> {
    const rows = await this.db
      .selectFrom('role_assignments')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('username', '=', username)
      .where('revoked_at', 'is', null)
      .execute();
    return rows.map(toDomain);
  }

  async findActive(coopname: string): Promise<RoleAssignmentData[]> {
    const rows = await this.db
      .selectFrom('role_assignments')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('revoked_at', 'is', null)
      .orderBy('assigned_at', 'asc')
      .execute();
    return rows.map(toDomain);
  }

  async assign(data: Omit<RoleAssignmentData, 'id' | 'assigned_at'>): Promise<boolean> {
    try {
      await this.db
        .insertInto('role_assignments')
        .values({
          coopname: data.coopname,
          username: data.username,
          extension_name: data.extension_name,
          role: data.role,
          assigned_by: data.assigned_by,
        })
        .execute();
      return true;
    } catch (error) {
      // Действующее назначение уже есть: повторное нажатие или вторая вкладка.
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) return false;
      throw error;
    }
  }

  async revoke(coopname: string, username: string, role: string, revokedBy: string): Promise<boolean> {
    const result = await this.db
      .updateTable('role_assignments')
      .set({ revoked_by: revokedBy, revoked_at: new Date() })
      .where('coopname', '=', coopname)
      .where('username', '=', username)
      .where('role', '=', role)
      .where('revoked_at', 'is', null)
      .execute();
    return affectedCount(result) > 0;
  }
}
