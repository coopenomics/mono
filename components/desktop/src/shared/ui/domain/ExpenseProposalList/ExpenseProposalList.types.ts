import type { Zeus } from '@coopenomics/sdk';

/** Строка списка СЗ-расходов — минимум, который отдаёт любой пул шасси. */
export interface ExpenseProposalListRow {
  expense_hash: string;
  /** Заголовок карточки (обычно описание первой позиции или цель расхода). */
  title: string;
  status: Zeus.ExpenseProposalStatus;
  /** Отформатированная плановая сумма (asset-строка). */
  total_planned: string;
  /** ФИО инициатора (или аккаунт, если имя не отрезолвлено). */
  creator_name?: string;
  created_at?: string;
}

export interface ExpenseProposalListProps {
  rows: ExpenseProposalListRow[];
  /** Скелетон на время первой загрузки (когда rows ещё пуст). */
  loading?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}
