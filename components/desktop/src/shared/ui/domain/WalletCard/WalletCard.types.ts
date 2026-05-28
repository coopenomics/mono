export type WalletProgram = 'blagorost' | 'wallet' | 'generator';

export interface WalletCardProps {
  /** Программа — задаёт акцент (--prog-blagorost / --prog-wallet / --prog-generator) */
  program: WalletProgram;
  /** Заголовок карточки. Default по программе: blagorost → «Благорост», wallet → «Кошелёк», generator → «Генератор» */
  title?: string;
  /** Дополнительная подпись под заголовком */
  subtitle?: string;
  /** Отформатированная сумма доступного баланса */
  balance: string;
  /** Тикер актива */
  symbol: string;
  /** Подпись основной метрики (default «Доступно») */
  balanceLabel?: string;
  /** Отформатированная сумма заблокированного остатка (рендерит locked-line) */
  lockedBalance?: string;
  /** Подпись заблокированной строки (default «Заблокировано») */
  lockedLabel?: string;
  /** Имя Quasar-иконки. Default по программе: savings / account_balance_wallet / bolt */
  icon?: string;
  /** Skeleton-плейсхолдер на время загрузки */
  loading?: boolean;
  /** Компактный вариант — `.wallet--row` (36px icon, 18px сумма, 14px padding). Для слота шапки */
  compact?: boolean;
  /** Пустое состояние — рисует 0,00 и приглушает цвета */
  empty?: boolean;
}
