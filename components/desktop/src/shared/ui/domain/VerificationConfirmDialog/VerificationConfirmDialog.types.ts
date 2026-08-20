/** Диалог сверки личности пайщика с документом перед подтверждением. */
export interface VerificationConfirmDialogProps {
  /** Открыт ли диалог. */
  modelValue: boolean;
  /** Заголовок окна. */
  title?: string;
  /** ФИО пайщика — то, что сверяют с документом. */
  fullName?: string;
  /** Имя аккаунта пайщика. */
  username: string;
  /** Пояснение, что именно требуется сделать. */
  hint: string;
  /** Надпись на подтверждающей кнопке. */
  confirmLabel?: string;
  /** Идёт подтверждение — кнопки заблокированы. */
  loading?: boolean;
}
