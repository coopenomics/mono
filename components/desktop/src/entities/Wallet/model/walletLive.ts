import { GatewayContract, Ledger2Contract, SovietContract, WalletContract } from 'cooptypes';
import { registerLiveReload, liveTable } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from './stores';

// Модуль не входит в бочку `model`: регистрируется один раз ядром приложения.

let registered = false;

/**
 * Кошелёк пайщика живёт по ленте изменений: остатки (ledger2::userwallets),
 * пополнения и выводы (gateway), подписи соглашений, участие в программах и
 * программные кошельки. Строки личные — сигнал получает сам пайщик (и совет).
 * Прежняя отдельная подписка `walletEvents` знала только остатки; теперь
 * кошелёк перечитывается по любому своему источнику.
 */
export function registerWalletLive(): void {
  if (registered) return;
  registered = true;
  registerLiveReload(
    [
      liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
      liveTable(GatewayContract, GatewayContract.Tables.Incomes),
      liveTable(GatewayContract, GatewayContract.Tables.Outcomes),
      liveTable(SovietContract, SovietContract.Tables.Agreements),
      liveTable(SovietContract, SovietContract.Tables.ProgramWallets),
      liveTable(SovietContract, SovietContract.Tables.Programs),
      liveTable(WalletContract, WalletContract.Tables.Users),
    ],
    reloadWallet,
  );
}

/** Дочитка кошелька текущего пайщика; без входа в систему делать нечего. */
async function reloadWallet(): Promise<void> {
  const username = useSessionStore().username;
  if (!username) return;
  const coopname = useSystemStore().info.coopname;
  if (!coopname) return;
  await useWalletStore().loadUserWallet({ coopname, username });
}
