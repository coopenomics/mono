import { Inject, Injectable, Optional } from '@nestjs/common';
import { CHAIN_CHANGES_PORT, type IChainChangesPort, type InnerChainChangesTable } from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EdubridgeAdminRepository } from '../../infrastructure/repositories/edubridge-admin.repository';

/**
 * Таблицы образования в ленте изменений. Имена — из `@Entity` сущностей;
 * стол подписывается на те же имена (desktop: `extensions/edubridge/shared/live.ts`).
 *
 * Курсы открыты всем — это каталог. Записи, ученики и возвраты принадлежат
 * пайщику, договоры, назначения, уроки и взносы — преподавателю: их сигналы
 * получает владелец строки и персонал. Задачи выдачи доступа, привязки
 * площадок и администраторы — только персоналу.
 */
export const EDU_LIVE_TABLES: InnerChainChangesTable[] = [
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_courses' },
  // Справочник разделов и уровней — как каталог, открыт всем.
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_sections' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_levels' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_enrollments', owner_field: 'member_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_learners', owner_field: 'member_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_return_requests', owner_field: 'member_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_teacher_contracts', owner_field: 'teacher_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_teacher_assignments', owner_field: 'teacher_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_lessons', owner_field: 'teacher_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_contributions', owner_field: 'teacher_username' },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_access_tasks', staff_only: true },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_connector_bindings', staff_only: true },
  { code: EDUBRIDGE_EXTENSION_NAME, table: 'edubridge_admins', staff_only: true },
];

/**
 * Живое обновление стола образования: объявляет таблицы в ленте изменений и
 * держит ядро в курсе, кто персонал образования (назначенные администраторы;
 * совет ядро считает персоналом само). Без ленты в контуре — ничего не делает.
 */
@Injectable()
export class EdubridgeLiveFeedService {
  constructor(
    private readonly admins: EdubridgeAdminRepository,
    @Optional() @Inject(CHAIN_CHANGES_PORT) private readonly feed: IChainChangesPort | null = null
  ) {}

  declareTables(): void {
    this.feed?.declareLocalTables(EDU_LIVE_TABLES);
  }

  /** Передать ядру текущий состав администраторов — при запуске и при смене. */
  async refreshStaff(coopname: string): Promise<void> {
    if (!this.feed) return;
    const admins = await this.admins.listAdmins(coopname);
    this.feed.setStaff(EDUBRIDGE_EXTENSION_NAME, admins.map((a) => a.username));
  }
}
