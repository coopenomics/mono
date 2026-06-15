/**
 * Реестр кошельков расходов (пулов) — фабричная точка сборки шасси расходов.
 *
 * Каждое расширение, подключающее шасси к своему пулу (capital — пул программных
 * расходов «Благорост», в будущем стол заказов — кошелёк членских взносов КУ),
 * регистрирует свой кошелёк из собственного `install.ts`. Стол совета (страница
 * «Расходы») лишь рендерит зарегистрированное и проваливается по `route` внутрь —
 * сам он ни одного пула не знает.
 *
 * Балансы по `wallet` подтягивает страница через `getLedger2Wallets`.
 */
import type { WalletProgram } from 'src/shared/ui/domain/WalletCard';

export interface ExpenseWalletEntry {
  /** ledger2-имя кошелька-пула (например, `w.cap.pgexp`). */
  wallet: string;
  /** Человеческое название пула для карточки. */
  title: string;
  /** Подпись под названием (чьи расходы ведутся из пула). */
  subtitle?: string;
  /** Material-иконка карточки. */
  icon?: string;
  /** Per-program тинт WalletCard (только для программных пулов). */
  program?: WalletProgram;
  /** Маршрут страницы расходов этого пула (реестр + создание). */
  route: { name: string };
}

const entries: ExpenseWalletEntry[] = [];

export function registerExpenseWallet(entry: ExpenseWalletEntry): void {
  if (entries.some((e) => e.wallet === entry.wallet)) return;
  entries.push(entry);
}

export function listExpenseWallets(): readonly ExpenseWalletEntry[] {
  return entries;
}
