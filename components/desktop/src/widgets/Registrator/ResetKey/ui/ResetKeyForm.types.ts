import type { IGeneratedAccount } from 'src/shared/lib/types/user';

/**
 * Состояние страницы перевыпуска ключа:
 * - `check-mail`: пайщик ещё не перешёл по ссылке (token нет в URL).
 *   Показываем уведомление «Письмо отправлено».
 * - `save-key`: token есть, ключ уже сгенерирован клиентом — показываем его
 *   readonly с copy-кнопкой и просим подтвердить сохранение.
 */
export type ResetKeyFormMode = 'check-mail' | 'save-key';

export interface ResetKeyFormProps {
  mode: ResetKeyFormMode;
  /** Сгенерированный аккаунт. Обязателен для `save-key`, игнорируется для `check-mail`. */
  account?: IGeneratedAccount | null;
  /** Состояние «занято» (вызов resetKey on-chain). */
  loading?: boolean;
}
