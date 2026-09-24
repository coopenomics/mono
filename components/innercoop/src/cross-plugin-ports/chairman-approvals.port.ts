/**
 * Одобрения председателя — документы, которые ждут его второй подписи
 * (договор УХД преподавателя, приложение к нему, коммит РИД и т. п.). Хранит их
 * расширение председателя; стол, чей процесс завёл одобрение, показывает его у
 * себя через этот порт. Одобрение одно и живёт в цепи: подпись на любом столе
 * закрывает его везде.
 */

/** Состояние одобрения — как в таблице одобрений контракта совета. */
export type InnerChairmanApprovalStatus = 'pending' | 'approved' | 'declined';

export interface InnerChairmanApproval {
  /** Хэш одобрения — по нему председатель подтверждает или отклоняет. */
  approval_hash: string;
  coopname: string;
  /** Пайщик, чей документ ждёт подписи. */
  username: string;
  /** Действие контракта-инициатора при одобрении (`apprvcontr`, `apprvannex`…) — тип одобрения. */
  action: string;
  status: InnerChairmanApprovalStatus;
  /** ISO 8601. */
  created_at: string;
}

export interface InnerChairmanApprovalsQuery {
  coopname: string;
  /** Типы одобрений — действия контракта-инициатора. Пусто — ничего. */
  actions: string[];
  /** Только эти пайщики; без поля — все. */
  usernames?: string[];
  /** Только эти состояния; без поля — все. */
  statuses?: InnerChairmanApprovalStatus[];
}

/**
 * Порт: одобрения председателя по типам и пайщикам. Реализация — расширение
 * председателя; регистрация через InnercoopBridgeModule.
 */
export interface IChairmanApprovalsPort {
  list(query: InnerChairmanApprovalsQuery): Promise<InnerChairmanApproval[]>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────

/** Одобрения председателя. Провайдер — расширение chairman. */
export const CHAIRMAN_APPROVALS_PORT = Symbol.for('Innercoop.CrossPlugin.ChairmanApprovals');
