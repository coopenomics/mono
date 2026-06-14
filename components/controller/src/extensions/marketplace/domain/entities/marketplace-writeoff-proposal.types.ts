/**
 * Story 8.1 (Эпик 8): жизненный цикл проекта списания скоропорта.
 *
 * Соответствие on-chain wroffprops:
 *   DRAFT       — приватный PG-черновик; on-chain ещё не существует.
 *   ON_AGENDA   — propwroff отправлен; есть soviet.decisions[decision_id];
 *                 wroffprops.status = proposed.
 *   AUTHORIZED  — пришёл callback marketplace::onmktwoauth от soviet'а;
 *                 wroffprops.status = authorized; protocol2 сохранён.
 *   EXECUTING   — backend в процессе цикла execwroff per-item (на цепи всё
 *                 ещё authorized; PG-маркер «работа идёт»).
 *   EXECUTED    — все items списаны; wroffprops.status = executed.
 *   REJECTED    — callback marketplace::onmktwodecl; wroffprops.status =
 *                 rejected.
 */
export type MarketplaceWriteoffProposalStatus =
  | 'DRAFT'
  | 'ON_AGENDA'
  | 'AUTHORIZED'
  | 'PENDING_CONFIRMATION'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'REJECTED';

export const MarketplaceWriteoffProposalStatuses = {
  DRAFT: 'DRAFT',
  ON_AGENDA: 'ON_AGENDA',
  AUTHORIZED: 'AUTHORIZED',
  // Совет одобрил проект; ожидается подтверждение фактического списания
  // председателем каждого кооперативного участка (подпись Служебной записки
  // 1111 → on-chain marketplace::confirmwroff). На цепи статус остаётся
  // authorized — PENDING_CONFIRMATION это PG-маркер «ждём склады».
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  EXECUTING: 'EXECUTING',
  EXECUTED: 'EXECUTED',
  REJECTED: 'REJECTED',
} as const satisfies Record<string, MarketplaceWriteoffProposalStatus>;

/**
 * Откуда взялся DRAFT: ежемесячный крон-сканер или ручное действие
 * председателя.
 */
export type MarketplaceWriteoffProposalTrigger = 'cron' | 'manual';

export const MarketplaceWriteoffProposalTriggers = {
  CRON: 'cron',
  MANUAL: 'manual',
} as const satisfies Record<string, MarketplaceWriteoffProposalTrigger>;

/**
 * Позиция к списанию = агрегат партий одного наименования на одном КУ в одном
 * состоянии (просрочено / без гарантии / годно). `inventory_ids` — все
 * штрих-коды из `marketplace_inventory`, попавшие в этот агрегат: после
 * executed каждый из них помечается WRITTEN_OFF. Несколько партий одного
 * товара сливаются в одну строку Заявления (а не дублируются), поэтому
 * связь one-item → many-lots.
 */
export interface MarketplaceWriteoffProposalItem {
  braname: string;
  asset_title: string;
  quantity: string;
  amount: string;
  reason: string;
  inventory_ids: string[];
  executed: boolean;
}

/**
 * Запись журнала решений по проекту — для отчётов и UI таймлайна.
 */
export interface MarketplaceWriteoffProposalDecisionEntry {
  at: string;
  actor: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface MarketplaceWriteoffProposalProps {
  id: string;
  coopname: string;
  trigger: MarketplaceWriteoffProposalTrigger;
  status: MarketplaceWriteoffProposalStatus;

  cycle_started_at: Date;
  proposal_hash: string;
  decision_id: number | null;

  proposed_by_account: string | null;
  decided_by_account: string | null;

  items: MarketplaceWriteoffProposalItem[];
  total_amount: string;

  /** Протокол совета (registry 1105) — JSON `IDocument2`. */
  protocol_doc: unknown | null;
  /** Заявление председателя (registry 1106) — JSON `IDocument2`. */
  statement_doc: unknown | null;
  reject_reason: string | null;
  decision_log: MarketplaceWriteoffProposalDecisionEntry[];

  submitted_at: Date | null;
  authorized_at: Date | null;
  executed_at: Date | null;
  rejected_at: Date | null;

  created_at: Date;
  updated_at: Date;
}
