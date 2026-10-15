/**
 * Человекочитаемые подписи к техническим именам — контракты и lifecycle-статусы.
 * Используются и в Sidebar, и в HomePage.
 */

export const CONTRACT_HUMAN: Record<string, string> = {
  registrator: 'Регистратор',
  wallet: 'Главный кошелёк',
  capital: '«Благорост»',
  marketplace: '«Стол заказов»',
  edubridge: '«Образование»',
  branch: 'Кооперативные участки',
  draft: 'Шаблоны документов',
  soviet: 'Совет',
  meet: 'Общие собрания',
  ledger2: 'Учёт операций',
  gateway: 'Платёжный шлюз',
  fund: 'Фонды',
  loan: 'Займы',
  expense: 'Расходы кооператива',
};

/** Имя контракта для людей; неизвестный контракт — по коду. */
export function contractHuman(code: string): string {
  return CONTRACT_HUMAN[code] ?? code;
}

export const STATUS_HUMAN: Record<string, string> = {
  proposed: 'предложен',
  approved: 'утверждён',
  active: 'действующий',
  deprecated: 'устаревший',
};

/**
 * Роли участников процесса. В YAML встречаются и короткие коды (`chairman`),
 * и готовые русские подписи («Председатель») — вторые отдаём как есть.
 */
export const ROLE_HUMAN: Record<string, string> = {
  candidate: 'Кандидат',
  contributor: 'Пайщик',
  member: 'Пайщик',
  orderer: 'Заказчик',
  offerer: 'Поставщик',
  supplier: 'Поставщик',
  teacher: 'Преподаватель',
  chairman: 'Председатель',
  branch_chairman: 'Председатель участка',
  soviet: 'Совет',
  council: 'Совет',
  soviet_members: 'Члены совета',
  meet: 'Общее собрание',
  gateway_operator: 'Кассир',
  gateway: 'Кассир',
  cashier: 'Кассир',
  accountant: 'Бухгалтер',
  trusted: 'Доверенное лицо',
  administrator: 'Администратор',
  admin: 'Администратор',
  backend: 'Платформа',
  cooperative: 'Кооператив',
  chairman_or_soviet: 'Председатель / Совет',
};

export function roleHuman(role: string | null | undefined): string {
  if (!role) return '';
  return ROLE_HUMAN[role] ?? role;
}

/** Вид движения по кошелькам. */
export const WALLET_OP_HUMAN: Record<string, string> = {
  ISSUE: 'зачисление',
  TRANSFER: 'перевод',
  BLOCK: 'блокировка',
  UNBLOCK: 'разблокировка',
  BURN: 'списание',
  NONE: 'без движения',
};
