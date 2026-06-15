import type { Zeus } from '@coopenomics/sdk';

/** Позиция черновика формы (живёт в localStorage до подачи). */
export interface ExpenseCreateDraftItem {
  number: string;
  description: string;
  amount: string;
  mechanics: Zeus.ExpenseMechanics;
  recipient_type: Zeus.ExpenseRecipientType;
  recipient_name?: string;
  requisites?: string;
  /** Назначение платежа (оплата по счёту организации/ИП). */
  payment_purpose?: string;
  recipient_account?: string;
  item_hash?: string;
  /** Идентификатор платёжного метода получателя-пайщика (SELF/MEMBER). */
  payment_method_id?: string | null;
}

/** Позиция в готовом для чейна виде (expense::createexp items). */
export interface ExpenseCreateChainItem {
  item_hash: string;
  mechanics: Zeus.ExpenseMechanics;
  recipient_type: Zeus.ExpenseRecipientType;
  recipient: string;
  description: string;
  planned_amount: string;
  payment_method_id?: string;
  requisites?: string;
  payment_purpose?: string;
}

/**
 * Собранный диалогом СЗ-расход: документ сгенерирован и подписан создателем,
 * позиции готовы для контракта. Подачу на чейн выполняет расширение-потребитель
 * (capital → createProgramExpense, КУ → своя мутация) через проп `submit`.
 */
export interface ExpenseCreatePayload {
  expense_hash: string;
  description: string;
  /** Срок исполнения, `YYYY-MM-DD` (значение date-input). */
  deadline: string;
  items: ExpenseCreateChainItem[];
  /** Подписанное заявление на расход (document2, type=2010). */
  statement: unknown;
}

export interface ExpenseCreateDialogProps {
  modelValue: boolean;
  /** ledger2-кошелёк-пул — источник средств расхода (фиксируется в тексте СЗ). */
  sourceWallet: string;
  /** Ключ черновика в localStorage — уникален на стол/пул. */
  draftKey: string;
  /** Заголовок диалога (по умолчанию «Создание расхода»). */
  title?: string;
  /** Подача собранного и подписанного СЗ на чейн. */
  submit: (payload: ExpenseCreatePayload) => Promise<unknown>;
}
