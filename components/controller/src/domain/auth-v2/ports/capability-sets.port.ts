/**
 * Порт назначаемых наборов возможностей (Story 6.11) — расширяемые роли поверх
 * базовых core-ролей (User/Member/Chairman). Председатель назначает пайщику
 * именованный НАБОР («бухгалтер»/«кассир»/…), а сами правила набора живут в
 * существующей `access_rules` с `subject_type='capability_set'` (Story 6.2) —
 * движок CASL и инвалидация переиспользуются, новой ветки авторизации нет.
 *
 * Отличие от двух соседних механизмов:
 *  - core-роль (`User/Member/Chairman`) — из `user.role`, статическая матрица L1;
 *  - персональный разовый capability (Story 6.7) — `access_rules` subject=participant;
 *  - НАБОР — переиспользуемый шаблон, назначаемый председателем многим пайщикам.
 *
 * Вычисляемые роли (оператор ПВЗ / председатель КУ) сюда НЕ входят — они
 * выводятся из контекста на своих столах, а не назначаются.
 */

/** Шаблон набора возможностей (реестр `capability_sets`). */
export interface CapabilitySet {
  /** Канон-id набора (English, self-documenting): `accountant`, `cashier`, … */
  setKey: string;
  /** Человеко-имя для UI (RU): «Бухгалтер», «Кассир». */
  title: string;
  /** Назначение набора для UI. */
  description: string;
  /** true — платформенный seed; false — кооп-кастомный. */
  builtin: boolean;
  /** Кооператив-владелец кастом-набора; null для платформенных. */
  coopname: string | null;
}

/** Назначение набора пайщику (`participant_capability_sets`). */
export interface CapabilitySetAssignment {
  username: string;
  setKey: string;
  /** Кто выдал (председатель). */
  grantedBy: string;
  grantedAt: string;
  /** TTL назначения; null — бессрочно. */
  expiresAt: string | null;
}

/** Вход на назначение набора пайщику. */
export interface AssignCapabilitySetInput {
  username: string;
  setKey: string;
  grantedBy: string;
  expiresAt?: string | null;
}

export const CAPABILITY_SETS_REPOSITORY = Symbol('CapabilitySetsRepository');

export interface ICapabilitySetsRepository {
  /** Каталог всех наборов (платформенные + кастомные коопа) — для admin-UI выдачи. */
  listSets(): Promise<CapabilitySet[]>;
  /** Набор по ключу (валидация перед назначением); null — нет такого. */
  findSet(setKey: string): Promise<CapabilitySet | null>;
  /** Ключи активных (не истёкших, не отозванных) наборов пайщика — для AbilityFactory. */
  listActiveSetKeys(username: string): Promise<string[]>;
  /** Активные назначения пайщика (для страницы «Персонал»). */
  listAssignments(username: string): Promise<CapabilitySetAssignment[]>;
  /** Назначить набор (идемпотентно «оживляет» ранее отозванный). */
  assign(input: AssignCapabilitySetInput): Promise<void>;
  /** Отозвать набор у пайщика (проставляет `revoked_at`); true — если было что отзывать. */
  revoke(username: string, setKey: string): Promise<boolean>;
}
