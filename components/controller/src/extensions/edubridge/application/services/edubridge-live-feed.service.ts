import { Inject, Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CHAIN_CHANGES_PORT,
  ROLE_ASSIGNMENT_CHANGED_EVENT,
  ROLE_ASSIGNMENTS_PORT,
  type IChainChangesPort,
  type InnerChainChangesTable,
  type IRoleAssignmentsPort,
  type RoleAssignmentChangedEvent,
} from '@coopenomics/innercoop';
import { EDU_ADMIN_ROLE } from '../access/edubridge-access-matrix';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';

/**
 * Таблицы образования в ленте изменений. Имена — из `@Entity` сущностей;
 * стол подписывается на те же имена (desktop: `extensions/edubridge/shared/live.ts`).
 *
 * Курсы открыты всем — это каталог. Записи и ученики принадлежат
 * пайщику, договоры, назначения, уроки и взносы — преподавателю: их сигналы
 * получает владелец строки и персонал. Задачи выдачи доступа, привязки
 * площадок — только персоналу.
 */
export const EDU_LIVE_TABLES: InnerChainChangesTable[] = [
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_courses' },
  // Группы курса — как каталог: набор и дата начала видны всем.
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_groups' },
  // Справочник разделов и уровней — как каталог, открыт всем.
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_sections' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_levels' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_enrollments', owner_field: 'member_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_guarantee_claims', owner_field: 'member_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_learners', owner_field: 'member_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_teacher_contracts', owner_field: 'teacher_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_teacher_assignments', owner_field: 'teacher_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_lessons', owner_field: 'teacher_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_contributions', owner_field: 'teacher_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_share_returns', owner_field: 'teacher_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_access_tasks', staff_only: true },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_connector_bindings', staff_only: true },
];

/**
 * Живое обновление стола образования: объявляет таблицы в ленте изменений и
 * держит ядро в курсе, кто персонал образования (держатели роли администратора;
 * совет ядро считает персоналом само). Без ленты в контуре — ничего не делает.
 */
@Injectable()
export class EdubridgeLiveFeedService {
  constructor(
    @Inject(ROLE_ASSIGNMENTS_PORT) private readonly roleAssignments: IRoleAssignmentsPort,
    @Optional() @Inject(CHAIN_CHANGES_PORT) private readonly feed: IChainChangesPort | null = null
  ) {}

  declareTables(): void {
    this.feed?.declareLocalTables(EDU_LIVE_TABLES);
  }

  /** Передать ядру текущий состав администраторов — при запуске и при смене. */
  async refreshStaff(): Promise<void> {
    if (!this.feed) return;
    const admins = await this.roleAssignments.holdersOf(EDUBRIDGE_EXTENSION_NAME, EDU_ADMIN_ROLE);
    this.feed.setStaff(EDUBRIDGE_EXTENSION_NAME, admins);
  }

  /** Председатель назначил или снял администратора — состав персонала перечитывается. */
  @OnEvent(ROLE_ASSIGNMENT_CHANGED_EVENT)
  async onRoleAssignmentChanged(event: RoleAssignmentChangedEvent): Promise<void> {
    if (event.extensionName !== EDUBRIDGE_EXTENSION_NAME) return;
    await this.refreshStaff();
  }
}
