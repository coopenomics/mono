export interface RailUserCardProps {
  /** Имя пайщика */
  name: string;
  /** Роль / должность (показывается под именем) */
  role?: string;
  /** URL аватара. Если не задан — рендерятся инициалы из `name` */
  avatarSrc?: string;
  /** Баланс в основном кошельке */
  balance?: string | number;
  /** Тикер актива */
  symbol?: string;
  /** Подпись баланса (default «Доступно») */
  balanceLabel?: string;
  /** Дополнительная строка — заблокированный остаток */
  lockedBalance?: string | number;
  /** Подпись заблокированного остатка (default «Заблокировано») */
  lockedLabel?: string;
  /** Подпись основной кнопки (default «Пополнить») */
  primaryActionLabel?: string;
  /** Маршрут, на который кликом по блоку баланса переходит пользователь.
   *  Если задан, баланс оборачивается в `<router-link>`. Параллельно
   *  эмитится `balance-click` — для аналитики или функциональных handler'ов. */
  balanceRoute?: string | Record<string, unknown>;
  /** Состояние свёртки баланса/кнопки. Управляется через v-model:collapsed */
  collapsed?: boolean;
  /** Показывать ли блок «Выйти» под карточкой */
  showSignout?: boolean;
  /** Подпись для signout (default «Выйти») */
  signoutLabel?: string;
}
