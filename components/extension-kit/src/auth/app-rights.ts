import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DomainError } from '../errors/domain-error';
import {
  checkRightScope,
  expandRights,
  GRANTED_SCOPE_KEY,
  RIGHT_METADATA_KEY,
  rightGrants,
  rightsHeld,
  type GrantedAction,
  type IGrantedScope,
  type IRightRequirement,
  type RightFacts,
  type RightScope,
  type RightsTable,
} from './rights';
import { hasServerSecret } from './server-secret';

/**
 * Описание прав приложения (C28-87).
 *
 * Приложение объявляет его один раз: таблицу прав, свои роли у пайщика,
 * условия строк и справочник объектов. Из описания работают и проверка
 * операции (`RightsGuard`), и права страниц рабочего стола (`desktopGrantsOf`) —
 * два описания одних прав не допускаются.
 */

/** Токен описания прав: каждое расширение даёт под ним своё. */
export const APP_RIGHTS = Symbol('APP_RIGHTS');

/** Пайщик, чьи права считаются: то, что знает о нём вход. */
export interface RightsCaller {
  username: string;
  /** Роль в узле: `user`, `member`, `chairman`. */
  role?: string | null;
  /** Статус учётной записи в узле. */
  status?: string | null;
}

/**
 * Полномочие роли словами: что пайщик с этой ролью читает или ведёт.
 * Показывается председателю на странице управления доступом.
 */
export interface RolePermission {
  /** Что именно: «Реестр платежей кооператива». */
  title: string;
  /** `read` — пайщик видит, `write` — пайщик меняет. */
  access: 'read' | 'write';
  /** Права таблицы `Ресурс:действие`, которые стоят за полномочием. */
  rights: readonly string[];
}

/**
 * Роль, которую приложение даёт назначать пайщикам. Права роли записаны в
 * таблице прав приложения под тем же ключом; назначение ведёт ядро.
 */
export interface AssignableRole<R extends string = string> {
  key: R;
  /** Название роли для председателя: «Кассир». */
  title: string;
  /** Что роль открывает пайщику — одной фразой. */
  description: string;
  /**
   * Полномочия роли по пунктам. Вместе они называют все права роли из
   * таблицы и ничего сверх них — расхождение ловит тест таблиц прав.
   */
  permissions: readonly RolePermission[];
  /**
   * Права ядра `Ресурс → действия`, которые нужны роли: страницы приложения
   * берут часть данных операциями ядра (бухгалтерия, пайщики, кошельки). Ядро
   * даёт их пайщику с этой ролью, не зная роли по имени. В полномочиях такие
   * права называются с приставкой `core/`: `core/Ledger:read`.
   */
  coreRights?: Readonly<Record<string, readonly string[]>>;
}

export interface AppRights<R extends string = string, C extends string = string> {
  /** Имя рабочего стола расширения: под ним выдаются права страниц. */
  readonly extensionName: string;
  readonly table: RightsTable<R, C>;
  /** Охват прав, у которых он в имени не записан: `Ресурс:действие` → охват. */
  readonly impliedScopes?: Readonly<Record<string, RightScope>>;
  /**
   * Код отказа для условия, которое ждёт выполнения. Порядок ключей — порядок,
   * в котором условия называются пайщику, когда не хватает нескольких.
   */
  readonly conditionDenials?: Readonly<Partial<Record<C, string>>>;
  /**
   * Условия, чтение которых стоит запроса к цепи или базе: читаются, только
   * когда без них право не складывается.
   */
  readonly lazyConditions?: readonly C[];

  /**
   * Роли таблицы, которые председатель назначает пайщикам на странице
   * управления доступом. Приложение объявляет их ядру при запуске и
   * дописывает назначенные в ответ `roles`.
   */
  readonly assignableRoles?: readonly AssignableRole<R>[];

  /** Роли приложения у пайщика. `request` — запрос, если роли уже посчитал гард членства. */
  roles(caller: RightsCaller, request?: unknown): Promise<R[]>;
  /**
   * Какие из условий `wanted` выполнены. `config` — настройки расширения,
   * когда вызывающий их уже прочитал.
   */
  conditions?(caller: RightsCaller, roles: R[], wanted: readonly C[], config?: unknown): Promise<ReadonlySet<C>>;
  /** Справочник объектов: найденные объекты вида `kind` по номерам. */
  locate?(kind: string, ids: string[]): Promise<RightFacts[]>;
  /** Участки, где пайщик председатель или доверенный. */
  kus?(username: string): Promise<readonly string[]>;
  /** Участки, где пайщик председатель. */
  chairedKus?(username: string): Promise<readonly string[]>;
  /**
   * Права страниц, открытых каждому, включая гостя: страница без входа
   * называет такое право в `requires`. Операций эти права не открывают.
   */
  readonly publicGrants?: readonly string[];
  /** Метки состояния для страниц стола сверх прав таблицы. */
  extraGrants?(caller: RightsCaller, roles: R[], held: ReadonlySet<C>): string[];
}

/** Исполнители столов совета: член совета и председатель. */
export type CouncilRole = 'council' | 'chairman';

/**
 * Роли совета по роли пайщика в узле: председатель — ещё и член совета.
 * Роль узла следует за составом совета в цепи; совет проходит по роли в любом
 * статусе учётной записи.
 */
export function councilRolesOf(role: string | null | undefined): CouncilRole[] {
  const core = String(role ?? '').toLowerCase();
  if (core === 'chairman') return ['council', 'chairman'];
  if (core === 'member') return ['council'];
  return [];
}

/** Исполнители приложения пайщиков: принятый пайщик, член совета, председатель. */
export type MemberRole = 'participant' | CouncilRole;

/** Статус учётной записи принятого пайщика. */
const ACCEPTED_STATUS = 'active';

/**
 * Роли пайщика в приложении: `participant` — принятый пайщик (кандидат и
 * вышедший прав пайщика не имеют), роли совета — по роли узла в любом статусе.
 */
export function memberRolesOf(caller: Pick<RightsCaller, 'role' | 'status'>): MemberRole[] {
  const accepted: MemberRole[] = caller.status === ACCEPTED_STATUS ? ['participant'] : [];
  return [...accepted, ...councilRolesOf(caller.role)];
}

/** Исход проверки права операции. */
export type RightOutcome =
  | { allowed: true; scope: IGrantedScope }
  | { allowed: false; reason: 'right' | 'condition' | 'scope'; denial: string };

const NO_RIGHT = 'KIT_INSUFFICIENT_RIGHTS';

function conditionOrder<C extends string>(def: AppRights<string, C>): C[] {
  return Object.keys(def.conditionDenials ?? {}) as C[];
}

/**
 * Действия требования, которые таблица даёт пайщику сейчас. Дешёвые условия
 * читаются одним запросом, дорогие — только когда без них ни одна строка не
 * складывается, а её остальные условия уже выполнены.
 */
async function grantedActions<R extends string, C extends string>(
  def: AppRights<R, C>,
  caller: RightsCaller,
  roles: R[],
  resource: string,
  actions: string[]
): Promise<{ granted: GrantedAction[]; missing?: C }> {
  const lazy = new Set<C>(def.lazyConditions ?? []);
  const held = new Set<C>();
  const read = new Set<C>();
  const resolve = async (wanted: C[]): Promise<void> => {
    const fresh = wanted.filter((condition) => !read.has(condition));
    if (fresh.length === 0 || !def.conditions) return;
    fresh.forEach((condition) => read.add(condition));
    for (const condition of await def.conditions(caller, roles, fresh)) held.add(condition);
  };

  const granted: GrantedAction[] = [];
  const unmet: C[][] = [];
  for (const action of actions) {
    const rows = rightGrants(def.table, roles, resource, action);
    if (rows.length === 0) continue;
    const satisfied = () => rows.filter((row) => row.when.every((condition) => held.has(condition)));
    // Безусловная строка без широкого охвата у соседей отвечает сразу.
    const settled = rows.some((row) => row.when.length === 0) && !rows.some((row) => row.wide);
    if (!settled) {
      await resolve(rows.flatMap((row) => row.when).filter((condition) => !lazy.has(condition)));
      if (satisfied().length === 0) {
        // Дорогие условия читаются для строк, у которых дешёвые уже выполнены.
        const worth = rows.filter((row) => row.when.every((condition) => lazy.has(condition) || held.has(condition)));
        await resolve(worth.flatMap((row) => row.when).filter((condition) => lazy.has(condition)));
      }
    }
    const ok = satisfied();
    if (ok.length > 0) granted.push({ action, wide: ok.some((row) => row.wide) });
    else unmet.push(...rows.map((row) => row.when.filter((condition) => !held.has(condition))));
  }
  if (granted.length > 0 || unmet.length === 0) return { granted };
  // Ближайшая к выполнению строка: та, где не хватает меньше всего условий.
  const nearest = [...unmet].sort((a, b) => a.length - b.length)[0];
  const order = conditionOrder(def);
  return { granted, missing: order.find((condition) => nearest.includes(condition)) ?? nearest[0] };
}

/**
 * Вправе ли пайщик на операцию: право по таблице, условие строки, затем
 * охват — на этот ли объект право действует.
 */
export async function checkRight<R extends string, C extends string>(
  def: AppRights<R, C>,
  caller: RightsCaller,
  roles: R[],
  requirement: IRightRequirement,
  args: Record<string, unknown>
): Promise<RightOutcome> {
  const actions = Array.isArray(requirement.action) ? requirement.action : [requirement.action];
  const { granted, missing } = await grantedActions(def, caller, roles, requirement.resource, actions);
  if (granted.length === 0) {
    if (missing === undefined) return { allowed: false, reason: 'right', denial: NO_RIGHT };
    return { allowed: false, reason: 'condition', denial: def.conditionDenials?.[missing] ?? NO_RIGHT };
  }
  const scope = await checkRightScope({
    resource: requirement.resource,
    granted,
    source: requirement.source,
    implied: def.impliedScopes,
    args,
    username: caller.username,
    kus: async () => (def.kus ? def.kus(caller.username) : []),
    chairedKus: async () => (def.chairedKus ? def.chairedKus(caller.username) : []),
    locate: async (kind, ids) => (def.locate ? def.locate(kind, ids) : []),
  });
  if (!scope.allowed) return { allowed: false, reason: 'scope', denial: scope.denial ?? NO_RIGHT };
  return { allowed: true, scope: scope.scope };
}

/** Все условия таблицы приложения. */
function allConditions<C extends string>(table: RightsTable<string, C>): C[] {
  const out = new Set<C>();
  for (const groups of Object.values(table)) for (const group of groups) group.when.forEach((condition) => out.add(condition));
  return [...out];
}

/**
 * Права пайщика для страниц рабочего стола. Стол сверяет требование страницы
 * простым вхождением, поэтому право на весь кооператив разворачивается в узкие
 * охваты здесь.
 */
export async function desktopGrants<R extends string, C extends string>(
  def: AppRights<R, C>,
  caller: RightsCaller,
  config?: unknown
): Promise<string[]> {
  const roles = await def.roles(caller);
  if (roles.length === 0) return [];
  const wanted = allConditions(def.table);
  const held = def.conditions && wanted.length > 0 ? await def.conditions(caller, roles, wanted, config) : new Set<C>();
  const grants = new Set(expandRights(rightsHeld(def.table, roles, held)));
  for (const extra of def.extraGrants?.(caller, roles, held) ?? []) grants.add(extra);
  return [...grants];
}

/** Что стол сообщает о пайщике провайдеру прав. */
export interface DesktopGrantsRequest {
  coopname?: string;
  username?: string | null;
  userRole?: string | null;
  userStatus?: string | null;
  config?: unknown;
}

/**
 * Провайдер прав стола из описания прав приложения. Расширение регистрирует
 * его в реестре прав столов вместо собственного провайдера.
 */
export function desktopGrantsOf<R extends string, C extends string>(
  def: AppRights<R, C>
): { readonly extensionName: string; resolveGrants(ctx: DesktopGrantsRequest): Promise<string[]> } {
  return {
    extensionName: def.extensionName,
    resolveGrants: async (ctx) => {
      const open = def.publicGrants ?? [];
      if (!ctx.username) return [...open];
      // Настроек расширения стол мог не передать: тогда условия по ним считаются невыполненными.
      const held = await desktopGrants(def, { username: ctx.username, role: ctx.userRole, status: ctx.userStatus }, ctx.config ?? null);
      return open.length > 0 ? [...new Set([...open, ...held])] : held;
    },
  };
}

/**
 * Гард прав приложения: читает `@RequireRight` операции и сверяет его с
 * описанием прав расширения, в модуле которого объявлена операция. Итог
 * сверки охвата кладёт в запрос — операция читает его `@GrantedScope()`.
 *
 * Вход пайщика проверяет гард входа перед ним (`GqlJwtAuthGuard`).
 */
@Injectable()
export class RightsGuard implements CanActivate {
  private readonly logger = new Logger(RightsGuard.name);

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(APP_RIGHTS) private readonly def: AppRights
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<IRightRequirement | undefined>(RIGHT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true;

    const gql = GqlExecutionContext.create(context);
    const request = gql.getContext()?.req;
    // Межсервисный вызов работает по всему кооперативу.
    if (hasServerSecret(request?.headers)) {
      const everything: IGrantedScope = { scopes: ['all'], kus: null };
      if (request) request[GRANTED_SCOPE_KEY] = everything;
      return true;
    }

    const user = request?.user as { username?: string; role?: string; status?: string } | undefined;
    if (!user?.username) throw DomainError.unauthorized('KIT_USER_NOT_AUTHORIZED');
    const caller: RightsCaller = { username: user.username, role: user.role, status: user.status };
    const roles = await this.def.roles(caller, request);
    const outcome = await checkRight(this.def, caller, roles, requirement, gql.getArgs<Record<string, unknown>>() ?? {});
    if (!outcome.allowed) {
      const actions = Array.isArray(requirement.action) ? requirement.action.join('|') : requirement.action;
      this.logger.warn(
        `forbidden-attempt: member=${caller.username} extension=${this.def.extensionName} operation=${context.getClass()?.name}.${context.getHandler()?.name} right=${requirement.resource}:${actions} reason=${outcome.reason} denial=${outcome.denial} roles=[${roles.join(', ')}]`
      );
      throw DomainError.forbidden(outcome.denial);
    }
    request[GRANTED_SCOPE_KEY] = outcome.scope;
    return true;
  }
}
