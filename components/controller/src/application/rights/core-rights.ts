import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { desktopGrantsOf, type AppRights, type RightFacts, type RightsCaller, type RightsTable } from '@coopenomics/extension-kit';
import { MonoAccountStatus } from '@coopenomics/innercoop';
import { ExtensionGrantsRegistry } from '~/application/desktop/extension-grants.registry';
import { MEET_REPOSITORY, type MeetPreProcessingRepository } from '~/domain/meet/repositories/meet-pre.repository';

/**
 * Исполнители ядра:
 *  - `account`     — любой вошедший: кандидат, принятый и вышедший пайщик;
 *  - `participant` — принятый пайщик;
 *  - `council`     — член совета: роль узла «член совета» или «председатель»;
 *  - `chairman`    — председатель совета.
 * Роль узла следует за составом совета в цепи. Совет проходит по роли в любом
 * статусе учётной записи; права пайщика действуют для принятого.
 */
export type CoreRightsRole = 'account' | 'participant' | 'council' | 'chairman';

/**
 * Таблица прав ядра (C28-87): роль → право `Ресурс:действие`.
 *
 * Сейчас в ней глава совета — общие собрания, решения, повестка, шаблоны
 * документов — и права чтения для страниц стола совета, чьи операции
 * переводятся следующими пунктами (реестры пайщиков, документов, платежей,
 * расходов, кооперативов союза). Следующие главы ядра дописывают свои строки.
 */
export const coreRightsTable: RightsTable<CoreRightsRole, never> = {
  account: [
    {
      when: [],
      rights: {
        // Свои документы читает каждый вошедший: кандидату нужны документы
        // вступления, вышедшему пайщику — его прежние.
        Document: ['read:own'],
      },
    },
  ],
  participant: [
    {
      when: [],
      rights: {
        // Собрание видит каждый пайщик; голос, подпись уведомления и подписи
        // председателя и секретаря собрания — только на своё имя.
        Meet: ['read', 'vote:own', 'acknowledge:own', 'sign:own'],
      },
    },
  ],
  council: [
    {
      when: [],
      rights: {
        Meet: ['read', 'create', 'sign:own'],
        FreeDecision: ['propose', 'generate'],
        Agenda: ['read'],
        DocumentTemplate: ['read'],
        // Страницы стола совета: операции под ними переводятся с главами ядра
        // «председатель» и «пайщик», состав читателей тот же.
        Participant: ['read:all'],
        Document: ['read:all'],
        Payment: ['read:all'],
        Expense: ['read:all'],
        Union: ['read'],
      },
    },
  ],
  chairman: [
    {
      when: [],
      rights: {
        Meet: ['restart'],
        Decision: ['authorize'],
        DocumentTemplate: ['propose'],
      },
    },
  ],
};

/** Роли ядра по роли и статусу пайщика в узле. */
export function coreRolesOf(caller: Pick<RightsCaller, 'role' | 'status'>): CoreRightsRole[] {
  const roles: CoreRightsRole[] = ['account'];
  if (caller.status === MonoAccountStatus.Active) roles.push('participant');
  const core = String(caller.role ?? '').toLowerCase();
  if (core === 'member' || core === 'chairman') roles.push('council');
  if (core === 'chairman') roles.push('chairman');
  return roles;
}

/** Столы ядра, права страниц которых выдаются из этой таблицы. */
const CORE_DESKTOPS = ['soviet'];

/**
 * Описание прав ядра: по нему работают общий гард операций ядра (`RightsGuard`)
 * и права страниц столов ядра.
 */
@Injectable()
export class CoreRights implements AppRights<CoreRightsRole, never>, OnModuleInit {
  readonly extensionName = 'core';
  readonly table = coreRightsTable;

  constructor(
    private readonly grantsRegistry: ExtensionGrantsRegistry,
    @Inject(MEET_REPOSITORY) private readonly meets: MeetPreProcessingRepository
  ) {}

  onModuleInit(): void {
    const hook = desktopGrantsOf(this);
    for (const extensionName of CORE_DESKTOPS) {
      this.grantsRegistry.register({ extensionName, resolveGrants: (ctx) => hook.resolveGrants(ctx) });
    }
  }

  async roles(caller: RightsCaller): Promise<CoreRightsRole[]> {
    return coreRolesOf(caller);
  }

  /**
   * Справочник объектов ядра. Собрание называет председателя и секретаря:
   * `MeetPresider` и `MeetSecretary` отдают одного, `MeetOfficer` — обоих.
   */
  async locate(kind: string, ids: string[]): Promise<RightFacts[]> {
    const found = await Promise.all(ids.map((hash) => this.meetOfficers(kind, hash)));
    return found.flat();
  }

  private async meetOfficers(kind: string, hash: string): Promise<RightFacts[]> {
    const meet = await this.meets.findByHash(hash);
    if (!meet) return [];
    if (kind === 'MeetPresider') return [{ owner: meet.presider }];
    if (kind === 'MeetSecretary') return [{ owner: meet.secretary }];
    if (kind === 'MeetOfficer') return [{ owner: meet.presider }, { owner: meet.secretary }];
    // i18n-ignore: ошибка разработчика — вид объекта назван в декораторе операции, пайщик этот текст не видит
    throw new Error(`Справочник объектов ядра не знает вид «${kind}»`);
  }
}
