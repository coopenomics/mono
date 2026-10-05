import { createMongoAbility, subject as ruleSubject, type MongoQuery } from '@casl/ability';
import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Таблица прав приложения (C28-87).
 *
 * Приложение объявляет одну таблицу: роль → условия → права `Ресурс:действие`.
 * Из неё собираются и серверная проверка операции, и набор прав для страниц
 * рабочего стола — два описания одних прав не допускаются. Здесь лежит общее
 * для всех приложений: вид таблицы, чтение её строк, декоратор операции и
 * сверка охвата. Роли, условия и объекты у каждого приложения свои.
 *
 * Охват сверяет общая проверка: операция называет, откуда взять владельца,
 * участок или получателя (`RightSource`), приложение описывает свои объекты
 * (справочник объектов отдаёт `RightFacts`), а правило каждого охвата записано
 * здесь один раз условием CASL.
 */

/**
 * Охват права: множество объектов ресурса, на которые оно действует.
 *  - `own`        — объекты, которые принадлежат пайщику;
 *  - `own-KU`     — объекты участков, где пайщик председатель или доверенный;
 *  - `chaired-KU` — объекты участков, где пайщик председатель;
 *  - `to-self`    — объекты, которые созданы другими и направлены пайщику;
 *  - `all`        — все объекты ресурса в кооперативе.
 */
export type RightScope = 'own' | 'own-KU' | 'chaired-KU' | 'to-self' | 'all';

/** Охват уже, чем «весь кооператив». */
export type NarrowRightScope = Exclude<RightScope, 'all'>;

/**
 * Охваты уже чем «весь кооператив». Третья часть имени права из этого списка —
 * охват; иная третья часть считается частью действия (`sign:closing`).
 */
const NARROW_SCOPES: ReadonlySet<string> = new Set(['own', 'own-KU', 'chaired-KU', 'to-self']);

/** Группа строк таблицы: права роли, которые действуют при условиях `when`. */
export interface RightsGroup<C extends string = string> {
  when: C[];
  rights: Record<string, string[]>;
}

export type RightsTable<R extends string = string, C extends string = string> = Record<R, RightsGroup<C>[]>;

/**
 * Даёт ли список действий ресурса требуемое действие. Право с охватом `all`
 * покрывает то же действие с узким охватом: «все объекты» включают «свои»,
 * «своего участка», «участка, где я председатель» и «адресованные мне».
 * Обратное неверно.
 */
export function rightMatches(actions: string[], action: string): boolean {
  if (actions.includes(action)) return true;
  const colon = action.lastIndexOf(':');
  if (colon > 0 && NARROW_SCOPES.has(action.slice(colon + 1))) {
    return actions.includes(`${action.slice(0, colon)}:all`);
  }
  return false;
}

/**
 * Условия, при которых право действует для пайщика с этими ролями: по одному
 * набору на каждую строку таблицы, которая даёт право. Право действует, когда
 * выполнен хотя бы один набор целиком. Пустой список — право ролям не положено.
 */
export function rightConditions<R extends string, C extends string>(
  table: RightsTable<R, C>,
  roles: R[],
  resource: string,
  action: string
): C[][] {
  const out: C[][] = [];
  for (const role of roles) {
    for (const group of table[role] ?? []) {
      const actions = group.rights[resource];
      if (actions && rightMatches(actions, action)) out.push(group.when);
    }
  }
  return out;
}

/** Строка таблицы, которая даёт право: её условия и способ, которым право дано. */
export interface RightGrant<C extends string = string> {
  when: C[];
  /** Право дано охватом `all` при узком требовании: сверять объект незачем. */
  wide: boolean;
}

/**
 * Строки таблицы, которые дают право пайщику с этими ролями. В отличие от
 * `rightConditions` различает, названо ли в строке само требуемое действие
 * или оно покрыто охватом `all`.
 */
export function rightGrants<R extends string, C extends string>(
  table: RightsTable<R, C>,
  roles: R[],
  resource: string,
  action: string
): RightGrant<C>[] {
  const out: RightGrant<C>[] = [];
  for (const role of roles) {
    for (const group of table[role] ?? []) {
      const actions = group.rights[resource];
      if (!actions) continue;
      if (!rightMatches(actions, action)) continue;
      // Строка с тем же действием на весь кооператив даёт широкий охват, даже
      // когда рядом названо и узкое: «все объекты» включают «свои».
      const colon = action.lastIndexOf(':');
      const narrow = colon > 0 && NARROW_SCOPES.has(action.slice(colon + 1));
      out.push({ when: group.when, wide: narrow && actions.includes(`${action.slice(0, colon)}:all`) });
    }
  }
  return out;
}

/** Права ролей, действующие при выполненных условиях `held`, в виде `Ресурс:действие`. */
export function rightsHeld<R extends string, C extends string>(
  table: RightsTable<R, C>,
  roles: R[],
  held: ReadonlySet<C>
): string[] {
  const set = new Set<string>();
  for (const role of roles) {
    for (const group of table[role] ?? []) {
      if (!group.when.every((condition) => held.has(condition))) continue;
      for (const [resource, actions] of Object.entries(group.rights)) {
        for (const action of actions) set.add(`${resource}:${action}`);
      }
    }
  }
  return [...set];
}

/** Что роли положено вообще, без условий: роль → ресурс → действия. */
export function rightsByRole<R extends string, C extends string>(table: RightsTable<R, C>): Record<R, Record<string, string[]>> {
  const out = {} as Record<R, Record<string, string[]>>;
  for (const role of Object.keys(table) as R[]) {
    const merged: Record<string, string[]> = {};
    for (const group of table[role]) {
      for (const [resource, actions] of Object.entries(group.rights)) {
        merged[resource] = [...(merged[resource] ?? []), ...actions];
      }
    }
    out[role] = merged;
  }
  return out;
}

/**
 * Развернуть права в набор для рабочего стола. Стол сверяет требование
 * страницы с набором простым вхождением и иерархии охватов не знает, поэтому
 * право `…:all` разворачивается в узкие охваты здесь, на сервере.
 */
export function expandRights(rights: string[]): string[] {
  const set = new Set<string>();
  for (const right of rights) {
    set.add(right);
    const colon = right.lastIndexOf(':');
    if (colon > 0 && right.slice(colon + 1) === 'all') {
      for (const scope of NARROW_SCOPES) set.add(`${right.slice(0, colon)}:${scope}`);
    }
  }
  return [...set];
}

export const RIGHT_METADATA_KEY = 'required_right';

/**
 * Откуда операция берёт объект сверки охвата. Пути записаны от аргументов
 * операции: `data.order_id`.
 *  - `self` — операция работает с данными вызвавшего, имя берётся из входа;
 *  - `ku`   — участок назван в запросе;
 *  - `of`   — объект справочника приложения по номеру (или списку номеров);
 *             `match: 'any'` — хватает одного подходящего объекта;
 *  - `list` — список: общая проверка отдаёт операции участки отбора,
 *             необязательный участок запроса сверяется с ними; `null` —
 *             запрос участка не называет.
 */
export type RightSource =
  | { self: true }
  | { ku: string }
  | { of: string; id: string; match?: 'all' | 'any' }
  | { list: string | null };

/** Источник «сам пайщик»: объекта сверки нет. */
export const SELF: RightSource = { self: true };

/** Требование операции: действие над ресурсом; список действий — любое из них. */
export interface IRightRequirement {
  resource: string;
  action: string | string[];
  /** Источник объекта сверки; обязателен у права с узким охватом. */
  source?: RightSource;
}

/**
 * Право, которое требует операция: `@RequireRight('Order', 'create')`.
 * Третьим аргументом операция называет источник объекта сверки:
 * `@RequireRight('Issuance', 'create', { of: 'Order', id: 'data.order_id' })`.
 * Сверяет требование гард приложения по своей таблице прав.
 */
export const RequireRight = (resource: string, action: string | string[], source?: RightSource) =>
  SetMetadata<string, IRightRequirement>(RIGHT_METADATA_KEY, { resource, action, source });

/** Узкий охват действия: из имени права либо из перечня приложения. */
export function scopeOfRight(
  resource: string,
  action: string,
  implied: Readonly<Record<string, RightScope>> = {}
): RightScope | null {
  const colon = action.lastIndexOf(':');
  const tail = colon > 0 ? action.slice(colon + 1) : '';
  if (tail === 'all' || NARROW_SCOPES.has(tail)) return tail as RightScope;
  return implied[`${resource}:${action}`] ?? null;
}

/** Что объект сообщает о себе для сверки охвата. */
export interface RightFacts {
  /** Пайщик, которому объект принадлежит. */
  owner?: string | null;
  /** Кооперативный участок объекта. */
  ku?: string | null;
  /** Пайщик, которому объект направлен. */
  recipient?: string | null;
}

/** Пайщик в сверке охвата. */
export interface RightActor {
  username: string;
  /** Участки, где пайщик председатель или доверенный. */
  kus: readonly string[];
  /** Участки, где пайщик председатель. */
  chairedKus: readonly string[];
}

/** Условие правила CASL для охвата: `can(action, resource, условие)`. */
export function scopeConditions(scope: NarrowRightScope, actor: RightActor): MongoQuery {
  switch (scope) {
    case 'own':
      return { owner: actor.username };
    case 'to-self':
      return { recipient: actor.username };
    case 'own-KU':
      return { ku: { $in: [...actor.kus] } };
    case 'chaired-KU':
      return { ku: { $in: [...actor.chairedKus] } };
  }
}

/** Охваты из списка, под которые подходит объект. */
export function scopesMatched(
  resource: string,
  scopes: readonly NarrowRightScope[],
  actor: RightActor,
  facts: RightFacts
): NarrowRightScope[] {
  return scopes.filter((scope) => {
    const ability = createMongoAbility([{ action: 'act', subject: resource, conditions: scopeConditions(scope, actor) }]);
    return ability.can('act', ruleSubject(resource, { ...facts }));
  });
}

/** Код отказа по охвату: чего пайщику не хватило. */
export const SCOPE_DENIALS: Readonly<Record<NarrowRightScope, string>> = {
  own: 'KIT_RIGHT_SCOPE_OWN',
  'own-KU': 'KIT_RIGHT_SCOPE_OWN_KU',
  'chaired-KU': 'KIT_RIGHT_SCOPE_CHAIRED_KU',
  'to-self': 'KIT_RIGHT_SCOPE_TO_SELF',
};

/** Охват, по которому операция выполняется: итог общей проверки. */
export interface IGrantedScope {
  /** Охваты, по которым право сложилось. */
  scopes: RightScope[];
  /**
   * Участки отбора списка (источник `list`): `null` — весь кооператив,
   * `undefined` — отбор по участкам к операции не относится.
   */
  kus?: string[] | null;
}

/** Действие требования, которое таблица дала пайщику. */
export interface GrantedAction {
  action: string;
  wide: boolean;
}

export interface ScopeCheckInput {
  resource: string;
  granted: readonly GrantedAction[];
  source?: RightSource;
  /** Охват прав, у которых он в имени не записан: `Ресурс:действие` → охват. */
  implied?: Readonly<Record<string, RightScope>>;
  /** Аргументы операции. */
  args: Record<string, unknown>;
  username: string;
  /** Участки пайщика читаются только для охватов участка. */
  kus: () => Promise<readonly string[]>;
  chairedKus: () => Promise<readonly string[]>;
  /** Справочник объектов приложения: найденные объекты по номерам. */
  locate: (kind: string, ids: string[]) => Promise<RightFacts[]>;
}

export interface ScopeCheckResult {
  allowed: boolean;
  /** Код отказа по охвату. */
  denial?: string;
  scope: IGrantedScope;
}

function readPath(args: Record<string, unknown>, path: string): unknown {
  let value: unknown = args;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Сверка охвата для операции. Право уже дано таблицей; здесь решается, на
 * этот ли объект оно действует. Объект, которого нет, сверку проходит:
 * «не найдено» отвечает сама операция.
 */
export async function checkRightScope(input: ScopeCheckInput): Promise<ScopeCheckResult> {
  const { resource, source, args } = input;
  const scopes = unique(
    input.granted.map((grant) => (grant.wide ? 'all' : scopeOfRight(resource, grant.action, input.implied))).filter(
      (scope): scope is RightScope => scope !== null
    )
  );
  // Право без охвата действует на ресурс целиком.
  const wide = scopes.includes('all') || input.granted.some((grant) => !grant.wide && scopeOfRight(resource, grant.action, input.implied) === null);
  const narrow = scopes.filter((scope): scope is NarrowRightScope => scope !== 'all');
  const pass = (scope: IGrantedScope): ScopeCheckResult => ({ allowed: true, scope });
  const deny = (scope: NarrowRightScope = narrow[0]): ScopeCheckResult => ({ allowed: false, denial: SCOPE_DENIALS[scope], scope: { scopes: [] } });

  if (!source || 'self' in source) return pass({ scopes });

  const actor = async (): Promise<RightActor> => ({
    username: input.username,
    kus: narrow.includes('own-KU') ? await input.kus() : [],
    chairedKus: narrow.includes('chaired-KU') ? await input.chairedKus() : [],
  });

  if ('list' in source) {
    const value = source.list === null ? null : readPath(args, source.list);
    const requested = value === undefined || value === null || value === '' ? null : String(value);
    if (wide) return pass({ scopes, kus: requested ? [requested] : null });
    const kuScope = narrow.find((scope) => scope === 'own-KU' || scope === 'chaired-KU');
    // Только «своё» и «адресовано мне»: список отбирается по имени пайщика.
    if (!kuScope) return pass({ scopes });
    const { kus, chairedKus } = await actor();
    const own = unique([...kus, ...chairedKus]);
    if (requested && !own.includes(requested)) return deny(kuScope);
    return pass({ scopes, kus: requested ? [requested] : own });
  }

  if (wide) return pass({ scopes });

  let facts: RightFacts[];
  if ('ku' in source) {
    const value = readPath(args, source.ku);
    facts = value === undefined || value === null ? [] : [{ ku: String(value) }];
  } else {
    const value = readPath(args, source.id);
    const ids = (Array.isArray(value) ? value : [value]).filter((id) => id !== undefined && id !== null).map(String);
    facts = ids.length > 0 ? await input.locate(source.of, ids) : [];
  }
  if (facts.length === 0) return pass({ scopes: [] });

  const who = await actor();
  const matched = facts.map((one) => scopesMatched(resource, narrow, who, one));
  const any = 'of' in source && source.match === 'any';
  const allowed = any ? matched.some((list) => list.length > 0) : matched.every((list) => list.length > 0);
  if (!allowed) return deny();
  return pass({ scopes: unique(matched.flat()) });
}

/** Ключ запроса, под которым гард кладёт итог сверки охвата. */
export const GRANTED_SCOPE_KEY = 'grantedScope';

/**
 * Охват, по которому операция выполняется: `@GrantedScope() scope: IGrantedScope`.
 * Списку он отдаёт участки отбора, операции с несколькими охватами — тот, по
 * которому право сложилось.
 */
export const GrantedScope = createParamDecorator((_data: unknown, context: ExecutionContext): IGrantedScope => {
  const request = GqlExecutionContext.create(context).getContext().req;
  return (request?.[GRANTED_SCOPE_KEY] as IGrantedScope | undefined) ?? { scopes: [] };
});
