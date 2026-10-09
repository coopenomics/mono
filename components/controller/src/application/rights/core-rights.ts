import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  desktopGrantsOf,
  memberRolesOf,
  type AppRights,
  type AssignableRole,
  type RightFacts,
  type RightsCaller,
  type RightsTable,
} from '@coopenomics/extension-kit';
import { ExtensionGrantsRegistry } from '~/application/desktop/extension-grants.registry';
import { NODE_ROLE_KEYS, RoleAssignmentsRegistry } from '~/application/access-roles/role-assignments.registry';
import { t } from '~/i18n';
import { MEET_REPOSITORY, type MeetPreProcessingRepository } from '~/domain/meet/repositories/meet-pre.repository';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { PAYMENT_FILE_REPOSITORY, type PaymentFileRepository } from '~/domain/gateway/repositories/payment-file.repository';

/**
 * Исполнители ядра:
 *  - `account`     — любой вошедший: кандидат, принятый и вышедший пайщик;
 *  - `participant` — принятый пайщик;
 *  - `council`     — член совета: роль узла «член совета» или «председатель»;
 *  - `chairman`    — председатель совета.
 * Роль узла следует за составом совета в цепи. Совет проходит по роли в любом
 * статусе учётной записи; права пайщика действуют для принятого.
 *
 * Назначаемые роли председатель выдаёт принятому пайщику на странице
 * управления доступом:
 *  - `cashier` — кассир: реестр платежей стола совета.
 */
export type CoreNodeRole = 'account' | 'participant' | 'council' | 'chairman';
export type CoreAssignableRole = 'cashier';
export type CoreRightsRole = CoreNodeRole | CoreAssignableRole;

/**
 * Таблица прав ядра (C28-87): роль → право `Ресурс:действие`.
 *
 * Охват «своё» (`:own`) сверяется с именем, названным в запросе: за другого на
 * узле не действует никто. Совет читает данные любого пайщика (`:all`) и
 * собирает документы своих решений на имя заявителя.
 */
export const coreRightsTable: RightsTable<CoreRightsRole, never> = {
  account: [
    {
      when: [],
      rights: {
        // Свои данные и вступление — каждому вошедшему: кандидат проходит
        // вступление, вышедший пайщик сохраняет доступ к своим данным.
        Account: ['read:own'],
        Document: ['read:own'],
        Agreement: ['read:own', 'generate:own', 'sign:own'],
        Registration: ['read:own', 'generate:own', 'submit:own', 'pay:own'],
        BranchChoice: ['select:own'],
        Branch: ['read'],
        Payment: ['read:own'],
        PaymentFile: ['read:own'],
        PaymentMethod: ['manage:own'],
        Wallet: ['read:own'],
        Inbox: ['read:own'],
        Process: ['read:own'],
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
        Withdraw: ['generate:own', 'create:own'],
        Deposit: ['create:own'],
        MembershipExit: ['generate:own'],
        ProviderPayment: ['generate:own', 'update:own'],
        ProviderSubscription: ['read:own'],
        PushSubscription: ['manage:own'],
        ExtensionOnboarding: ['read'],
        // Страница карты кооператора на столе пайщика; операцию карты ведёт её расширение.
        Card: ['read:own'],
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
        // Документы решений совета по заявлениям собираются на имя заявителя.
        DecisionDocument: ['generate'],
        Account: ['read:all'],
        Participant: ['read:all', 'create'],
        Document: ['read:all'],
        // Соглашение, подписанное ключом пайщика, совет вправе подать за него:
        // подпись сверяет сама операция.
        Agreement: ['read:all', 'sign:all', 'confirm'],
        Registration: ['read:all'],
        // Реестр платежей совет читает; подтверждают оплату и прикладывают
        // документы об оплате председатель и кассир (C28-90).
        Payment: ['read:all'],
        PaymentFile: ['read:all'],
        Wallet: ['read:all'],
        Process: ['read:all'],
        Ledger: ['read'],
        Chain: ['read'],
        NotificationJournal: ['read'],
        Extension: ['read'],
        // Совет проходит по роли в любом статусе учётной записи, поэтому права
        // пайщика, нужные столу совета, названы здесь повторно.
        ProviderSubscription: ['read:own', 'read:all'],
        ProviderPayment: ['generate:own', 'update:own'],
        PushSubscription: ['manage:own'],
        ExtensionOnboarding: ['read'],
        Card: ['read:own'],
        // Страницы стола совета, операции под которыми переводятся со своими
        // приложениями (расходы, кооперативы союза).
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
        Account: ['update', 'delete'],
        TwoFactor: ['read', 'reset'],
        Branch: ['manage'],
        Extension: ['manage'],
        ExtensionOnboarding: ['manage'],
        PaymentMethod: ['manage:all'],
        Payment: ['confirm'],
        PaymentFile: ['upload'],
        Ledger: ['move'],
        System: ['manage'],
        NotificationJournal: ['resend'],
        PushSubscription: ['read'],
        // Страница управления доступом: назначение ролей приложений пайщикам.
        AccessRole: ['manage'],
      },
    },
  ],
  cashier: [
    {
      when: [],
      rights: {
        // Реестр платежей стола совета: список, подтверждение оплаты и
        // документы об оплате.
        Payment: ['read:all', 'confirm'],
        PaymentFile: ['read:all', 'upload'],
      },
    },
  ],
};

/**
 * Приложение, под именем которого ядро объявляет назначаемые роли: страницы
 * ролей стоят на столе совета.
 */
export const CORE_ROLES_APP = 'soviet';

/** Роли ядра, которые председатель назначает пайщикам. */
export const coreAssignableRoles: readonly AssignableRole<CoreAssignableRole>[] = [
  {
    key: 'cashier',
    title: t('accessRoles.roles.cashier.title'),
    description: t('accessRoles.roles.cashier.description'),
    permissions: [
      { title: t('accessRoles.roles.cashier.permissions.registry'), access: 'read', rights: ['Payment:read:all'] },
      { title: t('accessRoles.roles.cashier.permissions.proofs'), access: 'read', rights: ['PaymentFile:read:all'] },
      { title: t('accessRoles.roles.cashier.permissions.confirm'), access: 'write', rights: ['Payment:confirm'] },
      { title: t('accessRoles.roles.cashier.permissions.upload'), access: 'write', rights: ['PaymentFile:upload'] },
    ],
  },
];

/**
 * Права страниц, открытых без входа: контакты кооператива и подтверждение
 * выхода по ссылке из письма.
 */
export const corePublicGrants: readonly string[] = ['Cooperative:read', 'MembershipExit:confirm'];

/** Роли ядра по роли и статусу пайщика в узле. */
export function coreRolesOf(caller: Pick<RightsCaller, 'role' | 'status'>): CoreNodeRole[] {
  return ['account', ...memberRolesOf(caller)];
}

/** Столы ядра, права страниц которых выдаются из этой таблицы. */
const CORE_DESKTOPS = ['soviet', 'chairman', 'participant'];

/**
 * Описание прав ядра: по нему работают общий гард операций ядра (`RightsGuard`)
 * и права страниц столов ядра.
 */
@Injectable()
export class CoreRights implements AppRights<string, never>, OnModuleInit {
  readonly extensionName = 'core';

  /**
   * Таблица ядра и права ядра, которые запросили роли приложений: страницы
   * приложения берут часть данных операциями ядра (стол бухгалтера читает
   * бухгалтерию и кошельки). Строки ядра главнее одноимённых.
   */
  get table(): RightsTable<string, never> {
    return { ...this.roleAssignments.coreRows(), ...coreRightsTable };
  }

  readonly publicGrants = corePublicGrants;
  readonly assignableRoles = coreAssignableRoles;

  /**
   * Справочник объектов ядра: вид объекта → его владельцы по номеру.
   * Собрание называет председателя и секретаря; платёж и файл платежа —
   * плательщика.
   */
  private readonly locators: Readonly<Record<string, (id: string) => Promise<RightFacts[]>>> = {
    MeetPresider: (hash) => this.meetOfficers(hash, ['presider']),
    MeetSecretary: (hash) => this.meetOfficers(hash, ['secretary']),
    MeetOfficer: (hash) => this.meetOfficers(hash, ['presider', 'secretary']),
    Payment: (hash) => this.paymentOwner(hash),
    PaymentFile: (id) => this.paymentFileOwner(id),
  };

  constructor(
    private readonly grantsRegistry: ExtensionGrantsRegistry,
    private readonly roleAssignments: RoleAssignmentsRegistry,
    @Inject(MEET_REPOSITORY) private readonly meets: MeetPreProcessingRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYMENT_FILE_REPOSITORY) private readonly paymentFiles: PaymentFileRepository
  ) {}

  onModuleInit(): void {
    this.roleAssignments.declare(CORE_ROLES_APP, this.assignableRoles);
    const hook = desktopGrantsOf(this);
    for (const extensionName of CORE_DESKTOPS) {
      this.grantsRegistry.register({ extensionName, resolveGrants: (ctx) => hook.resolveGrants(ctx) });
    }
  }

  /**
   * Роли узла и назначенные председателем. Назначение действует у принятого
   * пайщика: выход из кооператива закрывает доступ без снятия роли.
   */
  async roles(caller: RightsCaller): Promise<string[]> {
    const node = coreRolesOf(caller);
    if (!node.includes('participant')) return node;
    const assigned = await this.roleAssignments.rolesInCore(CORE_ROLES_APP, caller.username);
    // Роль узла назначением не получить: её даёт состав совета.
    return [...node, ...assigned.filter((role) => !NODE_ROLE_KEYS.has(role))];
  }

  async locate(kind: string, ids: string[]): Promise<RightFacts[]> {
    const locator = this.locators[kind];
    if (!locator) {
      // i18n-ignore: ошибка разработчика — вид объекта назван в декораторе операции, пайщик этот текст не видит
      throw new Error(`Справочник объектов ядра не знает вид «${kind}»`);
    }
    return (await Promise.all(ids.map((id) => locator(id)))).flat();
  }

  private async meetOfficers(hash: string, officers: ('presider' | 'secretary')[]): Promise<RightFacts[]> {
    const meet = await this.meets.findByHash(hash);
    return meet ? officers.map((officer) => ({ owner: meet[officer] })) : [];
  }

  /**
   * Плательщик платежа. Платежа с таким номером нет — владельца назвать
   * нечем, и узкий охват не подтверждается: чужие чеки не перебираются по номеру.
   */
  private async paymentOwner(hash: string): Promise<RightFacts[]> {
    const payment = await this.payments.findByHash(hash);
    return [payment?.username ? { owner: payment.username } : {}];
  }

  /** Файла с таким номером нет — «не найдено» отвечает сама операция. */
  private async paymentFileOwner(id: string): Promise<RightFacts[]> {
    const file = await this.paymentFiles.findById(Number(id));
    return file ? this.paymentOwner(file.payment_hash) : [];
  }
}
