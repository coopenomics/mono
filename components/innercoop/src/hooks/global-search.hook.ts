/**
 * Поставщик единого поиска.
 *
 * Окно столов и страниц на рабочем столе ищет сразу везде: пайщиков, документы,
 * записи приложений. Само окно ничего не знает о предметах поиска — оно шлёт
 * запрос ядру, ядро опрашивает зарегистрированных поставщиков и возвращает
 * находки группами. Поставщика регистрирует тот, кто владеет данными: ядро —
 * пайщиков и документы, расширение — свои записи.
 *
 * Направление обратное портам ядра: контракт реализует владелец данных,
 * вызывает ядро. Права поставщик проверяет сам — общее окно не должно стать
 * обходом прав, поэтому находки отдаются только те, что пайщик и так вправе
 * открыть.
 */

/** Кто ищет. */
export interface InnerGlobalSearchContext {
  coopname: string;
  username: string;
  /** Роль в кооперативе: пайщик, член совета, председатель. */
  userRole?: string;
  /** Состояние членства — для находок, открытых только действующему пайщику. */
  userStatus?: string;
}

/** Куда ведёт находка: именованный маршрут рабочего стола. */
export interface InnerGlobalSearchRoute {
  name: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

/**
 * Находка — данные, а не вёрстка: окно рисует находки всех поставщиков
 * одинаково.
 */
export interface InnerGlobalSearchHit {
  /** Уникален в пределах поставщика: по нему окно различает строки. */
  key: string;
  title: string;
  /** Короткое уточнение справа: аккаунт, дата, номер. */
  subtitle?: string;
  /** Значок Material Icons; без него окно берёт значок группы. */
  icon?: string;
  route: InnerGlobalSearchRoute;
}

export interface IGlobalSearchHook {
  /** Имя расширения в реестре платформы; ядро пишет `core`. */
  readonly extensionName: string;
  /** Ключ группы, уникальный среди поставщиков: `participants`, `documents`. */
  readonly key: string;
  /** Заголовок группы в окне. */
  readonly title: string;
  /** Значок группы Material Icons. */
  readonly icon: string;
  /** Место группы в выдаче: меньше — выше. */
  readonly order: number;

  /**
   * Находки по запросу. Пустой список — нормальный ответ: нечего показать или
   * у пайщика нет прав. Бросать исключение можно — ядро спишет его на этого
   * поставщика и вернёт остальные группы.
   */
  search(query: string, context: InnerGlobalSearchContext, limit: number): Promise<InnerGlobalSearchHit[]>;
}

/**
 * Реестр поставщиков поиска. Владелец данных кладёт себя сюда при запуске,
 * опрашивает ядро.
 */
export interface IGlobalSearchRegistryPort {
  register(provider: IGlobalSearchHook): void;
}

export const GLOBAL_SEARCH_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.GlobalSearchRegistry');
