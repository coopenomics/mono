import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  GLOBAL_SEARCH_REGISTRY_PORT,
  type IGlobalSearchHook,
  type IGlobalSearchRegistryPort,
  type InnerGlobalSearchContext,
  type InnerGlobalSearchHit,
  type MonoAccountStatus,
} from '@coopenomics/innercoop';
import { canAccess } from '../access/edubridge-access-matrix';
import { EdubridgeMembershipService } from '../membership/edubridge-membership.service';
import { EdubridgeNamesService } from '../membership/edubridge-names.service';
import { EdubridgeAdminService } from '../services/edubridge-admin.service';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';
import { EdubridgeLearnerKyselyRepository } from '../../infrastructure/repositories/edubridge-learner.kysely-repository';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { t } from '../../i18n';

/** Право на страницу, куда ведёт находка: без него группа пуста. */
interface PageRight {
  resource: string;
  action: string;
}

type Finder = (query: string, coopname: string, limit: number) => Promise<InnerGlobalSearchHit[]>;

/**
 * Образование в едином поиске окна столов и страниц: ученики (пайщики и их
 * обучающиеся) и преподаватели. Находки отдаются только тому, у кого есть
 * право на страницу, куда они ведут, — общее окно не обходит права приложения.
 */
@Injectable()
export class EdubridgeSearchProvider implements OnModuleInit {
  constructor(
    @Inject(GLOBAL_SEARCH_REGISTRY_PORT) private readonly registry: IGlobalSearchRegistryPort,
    private readonly membership: EdubridgeMembershipService,
    private readonly admin: EdubridgeAdminService,
    private readonly teachers: EdubridgeTeacherService,
    private readonly learners: EdubridgeLearnerKyselyRepository,
    private readonly names: EdubridgeNamesService
  ) {}

  onModuleInit(): void {
    this.registry.register(
      this.group({ key: 'edubridge-members', title: t('edubridge.search.membersGroup'), icon: 'groups', order: 40 }, { resource: 'EduRegistry', action: 'read' }, (q, c, n) => this.members(q, c, n))
    );
    this.registry.register(
      this.group({ key: 'edubridge-teachers', title: t('edubridge.search.teachersGroup'), icon: 'co_present', order: 41 }, { resource: 'EduAssignment', action: 'manage' }, (q, c) => this.teacherHits(q, c))
    );
  }

  private group(head: Pick<IGlobalSearchHook, 'key' | 'title' | 'icon' | 'order'>, right: PageRight, find: Finder): IGlobalSearchHook {
    return {
      ...head,
      extensionName: EDUBRIDGE_EXTENSION_NAME,
      search: async (query: string, context: InnerGlobalSearchContext, limit: number) => {
        if (!(await this.allowed(context, right))) return [];
        return (await find(query, context.coopname, limit)).slice(0, limit);
      },
    };
  }

  private async allowed(context: InnerGlobalSearchContext, right: PageRight): Promise<boolean> {
    const membership = await this.membership.resolve(context.coopname, { username: context.username, role: context.userRole, status: context.userStatus as MonoAccountStatus });
    return canAccess(membership.roles, right.resource, right.action);
  }

  /** Ученики: пайщик по ФИО и учётному имени, обучающийся — по имени; находка открывает карточку пайщика. */
  private async members(query: string, coopname: string, limit: number): Promise<InnerGlobalSearchHit[]> {
    const payers = (await this.admin.members(coopname, query)).slice(0, limit).map((m) => ({
      key: `member:${m.username}`,
      title: m.display_name || m.username,
      subtitle: m.username,
      icon: 'person',
      route: memberRoute(coopname, m.username),
    }));
    const found = await this.learners.searchByName(coopname, query, limit);
    const payerNames = await this.names.displayNames([...new Set(found.map((l) => l.member_username))]);
    const learners = found.map((l) => ({
      key: `learner:${l.id}`,
      title: l.display_name,
      subtitle: t('edubridge.search.learnerOf', { payer: payerNames.get(l.member_username) || l.member_username }),
      icon: 'school',
      route: memberRoute(coopname, l.member_username),
    }));
    return [...payers, ...learners];
  }

  /** Преподаватели по ФИО и учётному имени; находка открывает страницу преподавателя. */
  private async teacherHits(query: string, coopname: string): Promise<InnerGlobalSearchHit[]> {
    return (await this.teachers.listTeachers(coopname))
      .filter((teacher) => EdubridgeNamesService.matches(query, teacher.username, teacher.display_name))
      .map((teacher) => ({
        key: teacher.username,
        title: teacher.display_name || teacher.username,
        subtitle: teacher.username,
        icon: 'co_present',
        route: { name: 'edubridge-admin-teacher', params: { coopname, username: teacher.username } },
      }));
  }
}

/** Страница «Ученики» с открытой карточкой пайщика. */
function memberRoute(coopname: string, username: string): InnerGlobalSearchHit['route'] {
  return { name: 'edubridge-admin-registry', params: { coopname }, query: { member: username } };
}
