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
  /** Контрагент-получатель из реестра контрагентов (организация). */
  counterparty_id?: number | null;
  /** Назначение платежа по умолчанию выбранного контрагента — чтобы не затирать введённое вручную. */
  counterparty_default_purpose?: string;
}

/** Позиция в готовом для чейна виде (expense::createexp items). */
export interface ExpenseCreateChainItem {
  item_hash: string;
  mechanics: Zeus.ExpenseMechanics;
  recipient_type: Zeus.ExpenseRecipientType;
  recipient: string;
  /** Название организации-получателя: аккаунта у неё нет, реестр и кассир видят её по имени. */
  recipient_name?: string;
  description: string;
  planned_amount: string;
  payment_method_id?: string;
  /** Контрагент-получатель: наименование и реквизиты организации сервер берёт из его карточки. */
  counterparty_id?: number;
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

/**
 * Предзаполнение формы при открытии из готовой записи (например, из планового
 * расхода участка): описание расхода и первая позиция с суммой. Применяется
 * только к пустому черновику — начатую вручную форму не затирает.
 */
export interface ExpenseCreatePrefill {
  /** Назначение расхода — идёт в описание сметы и в первую позицию. */
  description: string;
  /** Сумма первой позиции, как её вводит пользователь (например «1500.00»). */
  amount: string;
  /** Срок исполнения, `YYYY-MM-DD`. */
  deadline?: string;
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
  /**
   * Кооперативный участок, от имени которого в записке добавляется новый
   * контрагент; пусто — контрагент кооператива.
   */
  braname?: string | null;
  /** Предзаполнение пустой формы данными записи-источника. */
  prefill?: ExpenseCreatePrefill;
}
