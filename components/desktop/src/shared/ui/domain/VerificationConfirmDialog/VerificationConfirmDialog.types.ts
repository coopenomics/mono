import type { BaseDialogSize } from 'src/shared/ui/base/BaseDialog';

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
  /** Подтверждать пока нельзя: не хватает того, без чего сверка не считается. */
  confirmDisabled?: boolean;
  /** Ширина окна: данных для сверки бывает много. */
  size?: BaseDialogSize;
}
