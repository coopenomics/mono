/** Назначение роли пайщику: кто назначил и когда. */
export interface RoleAssignmentData {
  id: number;
  coopname: string;
  username: string;
  extension_name: string;
  role: string;
  assigned_by: string;
  assigned_at: Date;
}

/**
 * Назначения ролей пайщикам (таблица `role_assignments`). Действующее
 * назначение — строка без отметки снятия; снятые строки остаются историей.
 */
export interface RoleAssignmentRepository {
  /** Действующие назначения пайщика. */
  findActiveByUser(coopname: string, username: string): Promise<RoleAssignmentData[]>;
  /** Действующие назначения кооператива, давние сверху. */
  findActive(coopname: string): Promise<RoleAssignmentData[]>;
  /** Назначить роль. `false` — у пайщика эта роль уже есть. */
  assign(data: Omit<RoleAssignmentData, 'id' | 'assigned_at'>): Promise<boolean>;
  /** Снять роль. `false` — действующего назначения нет. */
  revoke(coopname: string, username: string, role: string, revokedBy: string): Promise<boolean>;
}

export const ROLE_ASSIGNMENT_REPOSITORY = Symbol('RoleAssignmentRepository');
