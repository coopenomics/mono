import { refreshMenuBadges, registerMenuBadge } from 'src/shared/lib/menuBadges';
import { registerLiveReload } from 'src/shared/lib/realtime';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { getLoans } from '../api';
import { DEBT_LIVE_TABLES } from '../model';

/** Число на пункте «Мои займы» — сколько актов ждёт подписи пайщика. */
export function registerDebtMenuBadges(): void {
  registerMenuBadge('debt-loans', async () => {
    const session = useSessionStore();
    const { info } = useSystemStore();
    if (!session.isAuth || !info.coopname) return 0;
    const page = await getLoans({ filter: { coopname: info.coopname, status: 'SIGNED' as never }, options: { page: 1, limit: 50 } });
    return page.items.filter((loan) => loan.username === session.username && Boolean(loan.act)).length;
  });
  registerLiveReload(DEBT_LIVE_TABLES, () => refreshMenuBadges(['debt-loans']));
}
