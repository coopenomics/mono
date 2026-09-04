// processes/init-wallet/loadUserContext.ts
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { useAccountStore } from 'src/entities/Account/model';

/**
 * URL-fallback на случай, если `info.coopname` ещё не подгрузился из getSystemInfo
 * (гонка с входом: контекст поднимают раньше, чем ответил бэк). Без него ушёл бы
 * `loadUserWallet({ coopname: undefined })` → GraphQL 400.
 */
export function getCoopnameFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const src = window.location.hash || window.location.pathname || '';
  // hash вида "#/voskhod/..." или path "/voskhod/..."
  const m = src.replace(/^#/, '').match(/^\/?([a-z0-9_-]+)\b/i);
  return m ? m[1] : '';
}

/**
 * Поднять контекст пайщика: его учётная запись и, если он принят советом, кошелёк.
 *
 * Единственное место, где это описано. Раньше шаги были размазаны: фоновый процесс
 * `init-wallet` делал их при старте приложения, а восстановление доступа повторяло
 * своей копией — и разошлось на первой же правке: аккаунт грузили, кошелёк нет, из-за
 * чего в левом меню пропадала карточка пайщика вместе с кнопкой выхода (`walletReady`
 * там смотрит на `program_wallets`). Владелец 04.09.2026: «нельзя единое вынести и
 * переиспользовать?». Вынесено — зовите отсюда, а не копируйте.
 *
 * Кошелёк грузим ТОЛЬКО принятым советом: на промежуточных статусах
 * (created/joined/payed/registered) он пуст, а интерфейс начал бы просить подписи
 * документов, которых пайщик на этом этапе подписывать не должен.
 *
 * Флаг `session.loadComplete` НЕ трогаем — им управляет вызывающий: у фонового процесса
 * своя обработка таймаутов и разлогина, у восстановления — свой момент.
 */
export async function loadUserContext(): Promise<void> {
  const session = useSessionStore();
  const wallet = useWalletStore();
  const { info } = useSystemStore();
  const account = useAccountStore();

  const userAccount = await account.getAccount(session.username);
  if (userAccount) {
    session.setCurrentUserAccount(userAccount);
  }

  if (session.isFullyActive) {
    const coopname = info.coopname || getCoopnameFromUrl();
    await wallet.loadUserWallet({
      coopname,
      username: session.username,
    });
  }
}
