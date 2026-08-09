/**
 * Контракт записи реестра расширений. Сам реестр (`AppRegistry` с перечислением
 * конкретных расширений) остаётся в контроллере — это composition root; сюда вынесена
 * только форма записи, чтобы расширение могло её типизировать.
 */

/** Конфигурация рабочего стола, который предоставляет расширение. */
export interface IDesktopConfig {
  name: string; // уникальное имя стола (например: 'soviet', 'chairman')
  title: string; // отображаемое название (например: 'Стол Совета')
  icon?: string; // иконка для меню
  defaultRoute?: string; // маршрут по умолчанию для этого стола
}

/**
 * В каких сетях расширение разрешено ставить.
 *
 * Переключатель обкатки: приложение сначала открывают на тестовом контуре
 * (`NON_MAINNET_ONLY`), а когда оно готово к боевой эксплуатации — здесь же,
 * в реестре, переводят в `EVERYWHERE`.
 */
export enum ExtensionAvailability {
  /** Доступно в любой сети, включая основную. */
  EVERYWHERE = 'everywhere',
  /** Доступно только вне основной сети — тестовый и локальный контуры. */
  NON_MAINNET_ONLY = 'non_mainnet_only',
  /** Недоступно нигде — расширение ещё не открыто для установки. */
  NOWHERE = 'nowhere',
}

/** Вычисляет доступность расширения для сети, в которой работает узел. */
export function isExtensionAvailable(availability: ExtensionAvailability, isMainnet: boolean): boolean {
  switch (availability) {
    case ExtensionAvailability.EVERYWHERE:
      return true;
    case ExtensionAvailability.NON_MAINNET_ONLY:
      return !isMainnet;
    case ExtensionAvailability.NOWHERE:
      return false;
  }
}

/**
 * Описание расширения в реестре.
 * Поля readme/instructions живут здесь, а не в сущности расширения, чтобы не тащить
 * презентационные данные в домен.
 */
export interface IRegistryExtension {
  is_builtin: boolean; // расширение встроенное
  availability: ExtensionAvailability; // в каких сетях разрешено ставить
  is_internal: boolean; // расширение внутреннее
  desktops?: IDesktopConfig[]; // столы, которые предоставляет расширение
  external_url?: string; // ссылка на внешний ресурс
  title: string;
  description: string;
  image: string; // URL изображения
  class: any; // класс модуля расширения
  extensionClass: any; // класс расширения (для миграций схемы)
  schema: any; // Zod-схема конфига
  tags?: string[];
  readme: Promise<string>;
  instructions: Promise<string>;

  // Канон авторизации/онбординга столов выражается через grants: расширение публикует
  // ExtensionDesktopGrantsProvider, а гейтинг до принятия ЦПП сворачивается в вычисление
  // грантов (нет прав → стол/страница не видны).

  /** Обратная совместимость: наличие desktops означает, что это desktop-расширение. */
  get is_desktop(): boolean;
}

/** Запись реестра с уже вычисленной под текущую сеть доступностью — её потребляет DTO витрины. */
export type IResolvedRegistryExtension = Omit<IRegistryExtension, 'availability'> & { is_available: boolean };
