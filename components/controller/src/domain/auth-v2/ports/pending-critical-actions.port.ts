/**
 * Порты multi-party critical actions (CoopID, Story 6.8). Критическое действие требует
 * 2 подтверждений (инициатор + ≥1 член совета) в окне ≤24ч. Хранилище — coop_domain_db
 * (таблица `pending_critical_actions`, V2.4.9).
 */

/** Типы критических действий (статусы — enum, не строки). */
export enum CriticalActionType {
  ExcludeParticipant = 'exclude_participant',
  ChangeCouncilRoles = 'change_council_roles',
  ForceRecovery = 'force_recovery',
  ChangeVerificationTypes = 'change_verification_types',
}

/** Состояние критического действия. */
export enum CriticalActionStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Expired = 'expired',
  Cancelled = 'cancelled',
}

/** Одно подтверждение: кто и когда. */
export interface CriticalActionConfirmation {
  by: string;
  at: string;
}

/** Запись pending-действия. */
export interface PendingCriticalAction {
  id: string;
  actionType: CriticalActionType;
  actorId: string;
  targetId: string;
  payload: Record<string, unknown>;
  status: CriticalActionStatus;
  confirmations: CriticalActionConfirmation[];
  createdAt: string;
  expiresAt: string;
  finalizedAt?: string | null;
}

/** Данные для создания нового pending-действия. */
export interface NewCriticalAction {
  actionType: CriticalActionType;
  actorId: string;
  targetId: string;
  payload: Record<string, unknown>;
  expiresAt: string;
  /** Первое подтверждение — инициатор. */
  confirmations: CriticalActionConfirmation[];
}

export const PENDING_CRITICAL_ACTIONS_REPOSITORY = Symbol('PendingCriticalActionsRepository');

export interface IPendingCriticalActionsRepository {
  create(input: NewCriticalAction): Promise<PendingCriticalAction>;
  findById(id: string): Promise<PendingCriticalAction | null>;
  /** Перезаписать confirmations + status (+ finalized_at) действия. */
  update(action: PendingCriticalAction): Promise<void>;
  /** Pending-действия с истёкшим окном (expires_at <= now). */
  listExpired(nowIso: string): Promise<PendingCriticalAction[]>;
  /** Все критические действия, затрагивающие пайщика (audit-trail, Story 6.10), новые сверху. */
  listByTarget(targetId: string): Promise<PendingCriticalAction[]>;
}

export const CRITICAL_ACTION_NOTIFIER = Symbol('CriticalActionNotifier');

/** Канал-событие «совет, подтвердите критическое действие» (фан-аут per-member — downstream). */
export const CRITICAL_ACTION_PENDING_CHANNEL = 'coopid:critical-action:pending';

export interface ICriticalActionNotifier {
  /** Известить совет о новом критическом действии, ждущем подтверждения. */
  notifyPending(action: PendingCriticalAction): Promise<void>;
}
