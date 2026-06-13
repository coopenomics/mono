import type { MongoAbility } from '@casl/ability';

/**
 * Словарь CASL-авторизации auth-v2 (Story 6.1). Реальный `@casl/ability`-фундамент,
 * в который по Phase-2-пометке мигрирует marketplace-access-matrix (ветка
 * `marketplace2`): `Resource:action` → `can(action, Subject)`, квалификаторы
 * `:own`/`:own-KU` → CASL `conditions`.
 */

/**
 * Действия. База CRUD + `manage` (CASL-wildcard «всё над субъектом») + доменные
 * глаголы: `confirm` — второй подписант critical-action (Story 6.8); `vote` —
 * голос в решении (Story 6.3, same-coop policy).
 */
export type CoopAction = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'confirm' | 'vote';

/** Субъекты (ресурсы) домена auth-v2. `all` — CASL-wildcard для платформенного админа. */
export type CoopSubject =
  | 'Participant'
  | 'Session'
  | 'Certificate'
  | 'VerificationRule'
  | 'CoopSettings'
  | 'RecoveryStrategy'
  | 'CriticalAction'
  | 'Role'
  | 'Capability'
  /** Именованный набор возможностей (Story 6.11) — управляет председатель. */
  | 'CapabilitySet'
  | 'AuditEvent'
  // --- Субъекты доступа к рабочим столам/страницам (grant-строки для desktop
  // meta.requires). Имена — предложение на согласование при разводке desktop-gating;
  // на границе access_rules это свободные строки, переименовываются точечно.
  /** Стол бухгалтера (доступ набора `accountant`). */
  | 'AccountingDesk'
  /** Реестр платежей / будущий стол кассира (доступ набора `cashier`). */
  | 'PaymentRegistry'
  | 'all';

/** Тип Ability пайщика — собирается `AbilityFactory.createForParticipant`. */
export type AppAbility = MongoAbility<[CoopAction, CoopSubject]>;
