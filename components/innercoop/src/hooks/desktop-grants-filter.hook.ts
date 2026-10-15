import type { InnerDesktopGrantsContext } from './desktop-grants.hook';

/**
 * Сужение прав пайщика на столах ЧУЖОГО расширения.
 *
 * Одно приложение может менять видимость столов другого только через этот
 * конвейер ядра и только в одну сторону — сужая. Ядро берёт набор, выданный
 * владельцем стола, прогоняет его через все зарегистрированные фильтры и
 * оставляет пересечение: `result = input ∩ filter_1(input) ∩ … ∩ filter_n(input)`.
 * Пересечение коммутативно, поэтому порядок регистрации фильтров на итог не
 * влияет, а добавить право фильтр не может по построению.
 *
 * Отказ фильтра (исключение, таймаут) ядро трактует в пользу владельца стола:
 * набор остаётся нетронутым, а сбой попадает в журнал. Иначе чужая ошибка
 * прятала бы работающее приложение.
 *
 * К собственным столам фильтр не применяется — свои права расширение
 * формирует в `IDesktopGrantsHook`. К расширениям без провайдера грантов
 * (видимость по ролям) фильтр тоже не применяется: сужать нечего.
 *
 * Пример: «Образовательный мост» оставляет столы «Благороста» только
 * преподавателям — без собственного интерфейса к «Благоросту» и без правок в нём.
 */
export interface InnerDesktopGrantsFilterTarget {
  /** Расширение-владелец стола, чьи права сужаются. */
  extensionName: string;
  /** Права, выданные владельцем (после предыдущих фильтров — не важно, каких). */
  grants: readonly string[];
}

export interface IDesktopGrantsFilterHook {
  /** Имя расширения-автора фильтра в реестре платформы. */
  readonly extensionName: string;

  /**
   * Какие из выданных прав оставить. Возвращённые права, которых не было во
   * входном наборе, ядро отбрасывает. Вернуть `target.grants` — значит не
   * вмешиваться.
   */
  filterGrants(target: InnerDesktopGrantsFilterTarget, context: InnerDesktopGrantsContext): Promise<readonly string[]>;
}

/** Реестр фильтров. Расширение кладёт себя сюда при запуске. */
export interface IDesktopGrantsFilterRegistryPort {
  register(filter: IDesktopGrantsFilterHook): void;
  /** Снять фильтр при остановке расширения. */
  unregister(extensionName: string): void;
}

export const DESKTOP_GRANTS_FILTER_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.DesktopGrantsFilterRegistry');
