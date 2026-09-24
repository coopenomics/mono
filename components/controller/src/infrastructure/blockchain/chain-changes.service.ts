import { Inject, Injectable } from '@nestjs/common';
import type { PubSub } from 'graphql-subscriptions';
import type { IDelta } from '@coopenomics/extension-kit/sync';
import type { IChainChangesPort, InnerChainChangesTable } from '@coopenomics/innercoop';
import {
  BranchContract,
  DraftContract,
  GatewayContract,
  Ledger2Contract,
  MeetContract,
  RegistratorContract,
  SovietContract,
  WalletContract,
} from 'cooptypes';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import { config } from '~/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { isDeltaOwnedByCoop } from './delta-ownership';

/** Сигнал ленты: где и в каком блоке изменилась строка. Данных строки нет. */
export interface ChainChangeSignal {
  code: string;
  table: string;
  scope: string;
  primary_key: string;
  /** Блок изменения; 0 — изменение данных узла вне цепи. */
  block_num: number;
}

/** Таблицы ядра, которые читают столы. Расширения объявляют свои через порт. */
const CORE_TABLES: InnerChainChangesTable[] = [
  {
    code: Ledger2Contract.contractName.production,
    table: Ledger2Contract.Tables.UserWallets.tableName,
    owner_field: 'username',
  },
  // Кошелёк пайщика: пополнения и выводы, подписи соглашений, участие в
  // программах и программные кошельки — ему и совету.
  { code: GatewayContract.contractName.production, table: GatewayContract.Tables.Incomes.tableName, owner_field: 'username' },
  { code: GatewayContract.contractName.production, table: GatewayContract.Tables.Outcomes.tableName, owner_field: 'username' },
  { code: SovietContract.contractName.production, table: SovietContract.Tables.Agreements.tableName, owner_field: 'username' },
  { code: SovietContract.contractName.production, table: SovietContract.Tables.ProgramWallets.tableName, owner_field: 'username' },
  { code: WalletContract.contractName.production, table: WalletContract.Tables.Users.tableName, owner_field: 'username' },
  // Программы кооператива и обязательные соглашения — всем пайщикам.
  { code: SovietContract.contractName.production, table: SovietContract.Tables.Programs.tableName },
  { code: SovietContract.contractName.production, table: SovietContract.Tables.CoopAgreements.tableName },
  // Общекооперативные кошельки (пулы программ и расходов) — совету.
  {
    code: Ledger2Contract.contractName.production,
    table: Ledger2Contract.Tables.Wallets.tableName,
    staff_only: true,
  },
  // План счетов кооператива: каждая операция учёта меняет остатки счетов, по
  // ним живут стол бухгалтера (счета, операции, проводки, процессы) — совету.
  {
    code: Ledger2Contract.contractName.production,
    table: Ledger2Contract.Tables.Accounts.tableName,
    staff_only: true,
  },
  // Стол совета (C28-83). Решение — вопрос пайщика: сигнал ему и совету.
  {
    code: SovietContract.contractName.production,
    table: SovietContract.Tables.Decisions.tableName,
    owner_field: 'username',
  },
  // Состав совета: порог повестки и список членов. Он и так приходит каждому
  // пайщику в сведениях о кооперативе, поэтому таблица открыта.
  { code: SovietContract.contractName.production, table: SovietContract.Tables.Boards.tableName },
  // Карточка кооператива в реестре сети: реквизиты, взносы при вступлении,
  // контакты. Своя строка выделяется по username (правило принадлежности).
  { code: RegistratorContract.contractName.production, table: RegistratorContract.Tables.Cooperatives.tableName },
  // Общие собрания видят все пайщики: созыв, вопросы, ход голосования.
  { code: MeetContract.contractName.production, table: MeetContract.Tables.Meets.tableName },
  { code: MeetContract.contractName.production, table: MeetContract.Tables.Questions.tableName },
  // Выход пайщика из кооператива: заявление, решение, возврат — ему и совету.
  {
    code: RegistratorContract.contractName.production,
    table: RegistratorContract.Tables.Exits.tableName,
    owner_field: 'username',
  },
  // Кооперативные участки: создание, правка, смена председателя участка.
  { code: BranchContract.contractName.production, table: BranchContract.Tables.Branches.tableName },
  // Собрания и хозяйство кооперативного участка — всем пайщикам кооператива:
  // решения и их вопросы, веса голосов, помощь и траты участка.
  ...[
    BranchContract.Tables.Decisions,
    BranchContract.Tables.DecisionQuestions,
    BranchContract.Tables.Weights,
    BranchContract.Tables.WeightTotals,
    BranchContract.Tables.Aids,
    BranchContract.Tables.Spends,
  ].map((t) => ({ code: BranchContract.contractName.production, table: t.tableName })),
  // Заявка на доверенность председателя участка — заявителю и совету.
  { code: BranchContract.contractName.production, table: BranchContract.Tables.TrustReqs.tableName, owner_field: 'username' },
  // Пайщики кооператива в цепи: вступление, блокировка, выход.
  {
    code: SovietContract.contractName.production,
    table: SovietContract.Tables.Participants.tableName,
    owner_field: 'username',
  },
  // Шаблоны документов: редакции платформы (реестр draft) и утверждения совета.
  { code: DraftContract.contractName.production, table: DraftContract.Tables.Drafts.tableName },
  { code: DraftContract.contractName.production, table: DraftContract.Tables.Approvals.tableName },
];

/**
 * Таблицы базы узла, которые читают столы ядра. Конфигурация расширений несёт
 * состояние подключения ЦПП советом — экран подключения живёт по ней.
 */
const CORE_LOCAL_TABLES: InnerChainChangesTable[] = [
  // Установка, включение и подключение расширения меняют рабочий стол каждого
  // пайщика (столы, меню, гранты), поэтому сигнал открыт всем: данных строки,
  // в том числе настроек расширения, в нём нет.
  { code: 'core', table: 'extensions' },
  // Журнал работы расширений — совету.
  { code: 'core', table: 'extensions_logs', staff_only: true },
  // Собрание до созыва в цепи и итог обработки закрытого — узел ведёт их сам.
  { code: 'core', table: 'meet_pre' },
  { code: 'core', table: 'meet_processed' },
  // Платежи: пайщику — его платежи, совету — все.
  { code: 'core', table: 'payments', owner_field: 'username' },
  // Подтверждения к платежу — загрузившему и совету.
  { code: 'core', table: 'payment_files', owner_field: 'uploaded_by_username' },
  // Реестр пайщиков стола совета: учётные записи, кандидаты и сверки личности.
  { code: 'core', table: 'users', owner_field: 'username' },
  { code: 'core', table: 'candidates', owner_field: 'username' },
  // Журнал сверок пишется в другой базе сырым SQL — сигнал шлёт его репозиторий.
  { code: 'core', table: 'verification_reviews', owner_field: 'username' },
  // Назначения персонала (наборы прав) — назначенному и совету. Пишутся в
  // другой базе сырым SQL — сигнал шлёт их репозиторий.
  { code: 'core', table: 'participant_capability_sets', owner_field: 'username' },
  // Реестр подписанных документов: пайщику — его, совету — все.
  { code: 'core', table: 'signed_documents', owner_field: 'username' },
  // Вопросы повестки, которые узел отслеживает (утверждение редакций и т. п.) — совету.
  { code: 'core', table: 'tracking_rules', staff_only: true },
  // Заявление о выходе из кооператива — пайщику и совету.
  { code: 'core', table: 'membership_exit_requests', owner_field: 'username' },
  // Входящие уведомления пайщика — ему (и совету).
  { code: 'core', table: 'notification_inbox', owner_field: 'recipientUsername' },
  // Журнал уведомлений кооператива — совету.
  { code: 'core', table: 'notification_outbox', staff_only: true },
  { code: 'core', table: 'notification_deliveries', staff_only: true },
  // Сведения о кооперативе: настройки и статус системы видит каждый пайщик.
  { code: 'core', table: 'settings' },
  { code: 'core', table: 'system_status' },
];

/** Роли совета: персонал любого расширения. */
const COUNCIL_ROLES = ['chairman', 'member'];

/** Канал таблицы, открытой всем пайщикам кооператива. */
export function chainChangesTopic(coopname: string, code: string, table: string): string {
  return `chain:${coopname}:${code}:${table}`;
}

/** Канал строк личной таблицы, принадлежащих пайщику. */
export function chainChangesOwnerTopic(coopname: string, code: string, table: string, username: string): string {
  return `${chainChangesTopic(coopname, code, table)}:user:${username}`;
}

/** Канал персонала по таблице — все её строки (совет и персонал расширения). */
export function chainChangesStaffTopic(coopname: string, code: string, table: string): string {
  return `${chainChangesTopic(coopname, code, table)}:staff`;
}

/**
 * Лента изменений (см. `chain-changes.port.ts`). Потребитель цепи зовёт
 * `publish`, когда дельта сохранена и её слушатели отработали; подписчик базы
 * (`LocalChangesSubscriber`) зовёт `publishLocal` после фиксации записи —
 * сигнал никогда не опережает базу, и стол по нему читает уже новое.
 */
@Injectable()
export class ChainChangesService implements IChainChangesPort {
  private readonly tables = new Map<string, InnerChainChangesTable>();
  /** Таблицы базы узла по имени таблицы в базе. */
  private readonly localTables = new Map<string, InnerChainChangesTable>();
  private readonly staff = new Map<string, Set<string>>();

  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub
  ) {
    this.logger.setContext(ChainChangesService.name);
    this.declareTables(CORE_TABLES);
    this.declareLocalTables(CORE_LOCAL_TABLES);
  }

  declareTables(tables: InnerChainChangesTable[]): void {
    for (const t of tables) this.tables.set(key(t.code, t.table), t);
  }

  declareLocalTables(tables: InnerChainChangesTable[]): void {
    for (const t of tables) {
      this.tables.set(key(t.code, t.table), t);
      this.localTables.set(t.table, t);
    }
  }

  setStaff(code: string, usernames: string[]): void {
    this.staff.set(code, new Set(usernames));
  }

  /** Объявленная таблица либо `undefined`. */
  tableOf(code: string, table: string): InnerChainChangesTable | undefined {
    return this.tables.get(key(code, table));
  }

  /** Объявленная таблица базы узла по имени в базе. */
  localTableOf(dbTable: string): InnerChainChangesTable | undefined {
    return this.localTables.get(dbTable);
  }

  /** Все объявленные таблицы — для подписки без перечня. */
  declared(): InnerChainChangesTable[] {
    return [...this.tables.values()];
  }

  /** Получает ли пайщик все строки таблиц расширения: совет — всегда. */
  isStaff(code: string, user: { username?: string; role?: string }): boolean {
    if (COUNCIL_ROLES.includes(String(user.role))) return true;
    return Boolean(user.username && this.staff.get(code)?.has(user.username));
  }

  /**
   * Опубликовать изменение строки цепи. Необъявленная таблица и чужой
   * кооператив — молчим. Принадлежность — то же правило, что у потребителя
   * цепи (`isDeltaOwnedByCoop`): не только область кооператива, но и
   * `coopname` в строке, общие таблицы платформы (реестр шаблонов) и реестр
   * кооперативов сети по своему полю. Снятая строка личной таблицы значения не несёт,
   * владельца не назвать — её видит только персонал.
   */
  async publish(delta: IDelta): Promise<void> {
    const declared = this.tableOf(delta.code, delta.table);
    if (!declared || !isDeltaOwnedByCoop(delta, config.coopname)) return;
    const owner = delta.present !== false ? (delta.value as Record<string, unknown> | undefined)?.[declared.owner_field ?? ''] : undefined;
    await this.route(declared, {
      code: delta.code,
      table: delta.table,
      scope: String(delta.scope),
      primary_key: String(delta.primary_key),
      block_num: Number(delta.block_num),
    }, owner);
  }

  /** Опубликовать изменение таблицы базы узла — после фиксации записи. */
  async publishLocal(dbTable: string, primary_key: string, row?: Record<string, unknown>): Promise<void> {
    const declared = this.localTableOf(dbTable);
    if (!declared) return;
    const owner = declared.owner_field ? row?.[declared.owner_field] : undefined;
    await this.route(declared, {
      code: declared.code,
      table: declared.table,
      scope: config.coopname,
      primary_key,
      block_num: 0,
    }, owner);
  }

  /**
   * Каналы сигнала: служебная таблица — персоналу; личная — владельцу строки
   * и персоналу; остальные — всем. Сбой шины не должен ронять разбор цепи и
   * запись в базу: ошибка — в журнал.
   */
  private async route(declared: InnerChainChangesTable, signal: ChainChangeSignal, owner: unknown): Promise<void> {
    const coopname = config.coopname;
    const topics: string[] = [];
    if (declared.staff_only) {
      topics.push(chainChangesStaffTopic(coopname, signal.code, signal.table));
    } else if (declared.owner_field) {
      // Владельцев у строки может быть несколько (участники звонка) — сигнал
      // каждому.
      for (const name of ownersOf(owner)) topics.push(chainChangesOwnerTopic(coopname, signal.code, signal.table, name));
      topics.push(chainChangesStaffTopic(coopname, signal.code, signal.table));
    } else {
      topics.push(chainChangesTopic(coopname, signal.code, signal.table));
    }

    try {
      await Promise.all(topics.map((topic) => this.pubSub.publish(topic, { chainChanges: signal })));
    } catch (error: any) {
      this.logger.warn(`Лента изменений: сигнал ${signal.code}::${signal.table} не опубликован — ${error?.message ?? error}`);
    }
  }
}

/** Владельцы строки: одно имя либо список имён; пустые значения отбрасываются. */
function ownersOf(owner: unknown): string[] {
  const list = Array.isArray(owner) ? owner : [owner];
  return [...new Set(list.filter((name) => typeof name === 'string' && name.length > 0) as string[])];
}

function key(code: string, table: string): string {
  return `${code}::${table}`;
}
