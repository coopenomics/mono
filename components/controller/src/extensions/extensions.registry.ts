// ========== ./extensions.registry.ts ==========

import { PowerupExtensionModule, PowerupExtension, Schema as PowerupSchema } from './powerup/powerup-extension.module';
import { ChatCoopExtensionModule, ChatCoopExtension, Schema as ChatCoopSchema } from './chatcoop/chatcoop-extension.module';
import fs from 'node:fs/promises';
import { YookassaExtensionModule, YookassaExtension, Schema as YookassaSchema } from './yookassa/yookassa-extension.module';
import { SberpollExtensionModule, SberpollExtension, Schema as SberpollSchema } from './sberpoll/sberpoll-extension.module';
import { QrPayExtensionModule, QrPayExtension, Schema as QRPaySchema } from './qrpay/qrpay-extension.module';
import path from 'path';
import { BuiltinExtensionModule, BuiltinExtension, Schema as BuiltinSchema } from './builtin/builtin-extension.module';
import { ChairmanExtensionModule, ChairmanExtension, Schema as ChairmanSchema } from './chairman/chairman-extension.module';
import { ParticipantExtensionModule } from './participant/participant-extension.module';
import { Schema as ParticipantSchema } from './participant/types';
import { CapitalExtensionModule, CapitalExtension, Schema as CapitalSchema } from './capital/capital-extension.module';
import { ReportsExtensionModule } from './reports/reports-extension.module';
import { MarketplaceExtensionModule, MarketplaceExtension } from './marketplace/marketplace-extension.module';
import { Schema as MarketplaceSchema } from './marketplace/types';
import { KuExtensionModule, KuExtension, Schema as KuSchema } from './ku/ku-extension.module';

/**
 * Конфигурация рабочего стола (workspace), который предоставляет расширение
 */
export interface IDesktopConfig {
  name: string; // уникальное имя workspace (например: 'soviet', 'chairman')
  title: string; // отображаемое название (например: 'Стол Совета')
  icon?: string; // иконка для меню
  defaultRoute?: string; // маршрут по умолчанию для этого workspace
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

/**
 * Вычисляет доступность расширения для сети, в которой работает узел.
 */
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
 * Основной интерфейс для описания расширения в реестре.
 * Обрати внимание: сохраняем его тут, а не в домене, чтобы не тянуть поля readme, instructions и т.д. в домен.
 */
export interface IRegistryExtension {
  is_builtin: boolean; // признак, что расширение встроенное (?)
  availability: ExtensionAvailability; // в каких сетях расширение разрешено ставить
  is_internal: boolean; // признак, что расширение внутреннее
  desktops?: IDesktopConfig[]; // массив рабочих столов, которые предоставляет расширение
  external_url?: string; // ссылка на внешний ресурс
  title: string; // заголовок/название расширения
  description: string; // краткое описание
  image: string; // URL к изображению
  class: any; // класс модуля-расширения
  extensionClass: any; // класс расширения (для миграций схемы)
  schema: any; // Zod-схема (или другая), которая описывает конфиг
  tags?: string[]; // список тегов
  readme: Promise<string>; // README содержимое
  instructions: Promise<string>; // INSTALL содержимое

  // Канон авторизации/онбординга столов теперь выражается через grants:
  // расширение публикует ExtensionDesktopGrantsProvider (см.
  // domain/desktop/ports/extension-grants.port.ts), а гейтинг до принятия ЦПП
  // сворачивается в вычисление грантов (нет прав → стол/страница не видны).
  // Отдельные поля onboarding_route/onboarding_desktop/isOnboarded больше не
  // нужны. Подробности — components/context/notes/EXTENSIONS_SCHEMA_SYSTEM.md.

  // Для обратной совместимости: если есть desktops, значит это desktop расширение
  get is_desktop(): boolean;
}

interface INamedExtension {
  [key: string]: IRegistryExtension;
}

/**
 * Запись реестра, у которой доступность уже вычислена под текущую сеть узла.
 * Именно её потребляет DTO — наружу отдаётся готовый `is_available`.
 */
export type IResolvedRegistryExtension = Omit<IRegistryExtension, 'availability'> & { is_available: boolean };

// Асинхронные функции для чтения Markdown
function getReadmeContent(dirPath: string): Promise<string> {
  return fs.readFile(path.join(__dirname, dirPath, 'README.md'), 'utf-8').catch(() => '');
}
function getInstructionsContent(dirPath: string): Promise<string> {
  return fs.readFile(path.join(__dirname, dirPath, 'INSTALL.md'), 'utf-8').catch(() => '');
}

/**
 * Глобальный объект, хранящий все доступные расширения.
 * Ключ — это name расширения, значение — объект IRegistryExtension.
 */
export const AppRegistry: INamedExtension = {
  soviet: {
    is_builtin: true,
    is_internal: true,
    availability: ExtensionAvailability.EVERYWHERE,
    desktops: [
      {
        name: 'soviet',
        title: 'Стол Совета',
        icon: 'fa-solid fa-gavel',
      },
    ],
    title: 'Стол Совета',
    description: 'Приложение для управления решениями в кооперативе.',
    image: 'https://i.ibb.co/Q3NmVvzN/Chat-GPT-Image-10-2025-20-40-44.png',
    class: BuiltinExtensionModule,
    extensionClass: BuiltinExtension,
    schema: BuiltinSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./yookassa'),
    instructions: getInstructionsContent('./yookassa'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  capital: {
    is_builtin: false,
    is_internal: true,
    availability: ExtensionAvailability.EVERYWHERE,
    desktops: [
      {
        name: 'capital',
        title: 'Стол благороста',
        icon: 'fa-solid fa-seedling',
      },
    ],
    title: 'Благорост',
    description: 'Приложение для управления интеллектуальными и имущественными вкладами по целевой программе "Благорост".',
    image: 'https://i.ibb.co/HRW1nFY/Chat-GPT-Image-10-2025-20-40-57.png',
    class: CapitalExtensionModule,
    extensionClass: CapitalExtension,
    schema: CapitalSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./capital'),
    instructions: getInstructionsContent('./capital'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  chairman: {
    is_builtin: true,
    is_internal: true,
    availability: ExtensionAvailability.EVERYWHERE,
    desktops: [
      {
        name: 'chairman',
        title: 'Стол Председателя',
        icon: 'fa-solid fa-user-tie',
      },
    ],
    title: 'Стол Председателя',
    description: 'Приложение для председателя совета кооператива.',
    image: 'https://i.ibb.co/6C5F3kD/Chat-GPT-Image-10-2025-20-42-42.png',
    class: ChairmanExtensionModule,
    extensionClass: ChairmanExtension,
    schema: ChairmanSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./chairman'),
    instructions: getInstructionsContent('./chairman'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  trustee: {
    is_builtin: true,
    is_internal: true,
    availability: ExtensionAvailability.EVERYWHERE,
    desktops: [
      {
        name: 'trustee',
        title: 'Кооперативный участок',
        icon: 'fa-solid fa-users-cog',
      },
    ],
    title: 'Кооперативный участок',
    description: 'Собрания пайщиков кооперативных участков: учреждение участков решением собрания с утверждением советом, свободные решения и приём доверенных лиц по заявлению.',
    image: 'https://i.ibb.co/MxbHCqqf/Chat-GPT-Image-11-2025-18-26-44.png',
    class: KuExtensionModule,
    extensionClass: KuExtension,
    schema: KuSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./ku'),
    instructions: getInstructionsContent('./ku'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  participant: {
    is_builtin: true,
    is_internal: true,
    availability: ExtensionAvailability.EVERYWHERE,
    desktops: [
      {
        name: 'participant',
        title: 'Стол Пайщика',
        icon: 'fa-solid fa-user',
      },
    ],
    title: 'Стол Пайщика',
    description: 'Приложение для управления персональным членством пайщика в кооперативе и отслеживания общих собраний.',
    image: 'https://i.ibb.co/gFHMX4s9/Chat-GPT-Image-11-2025-18-17-27.png',
    class: ParticipantExtensionModule,
    extensionClass: BuiltinExtension, // Participant использует тот же BuiltinExtension
    schema: ParticipantSchema,
    tags: ['стол', 'управление', 'уведомления'],
    readme: getReadmeContent('./participant'),
    instructions: getInstructionsContent('./participant'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  powerup: {
    is_builtin: false,
    is_internal: true,
    availability: ExtensionAvailability.EVERYWHERE,
    desktops: [
      {
        name: 'powerup',
        title: 'Стол вычислительных ресурсов',
        icon: 'fa-solid fa-server',
      },
    ],
    title: 'Стол вычислительных ресурсов',
    description: 'Приложение для управления вычислительными ресурсами кооператива.',
    image: 'https://i.ibb.co/7np8Bpm/DALL-E-Futuristic-Robot-Art-Nouveau.webp',
    class: PowerupExtensionModule,
    extensionClass: PowerupExtension,
    schema: PowerupSchema,
    tags: ['утилиты', 'ресурсы'],
    readme: getReadmeContent('./powerup'),
    instructions: getInstructionsContent('./powerup'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  yookassa: {
    is_builtin: false,
    is_internal: true,
    availability: ExtensionAvailability.NOWHERE,
    desktops: undefined, // Это не desktop расширение
    title: 'Оплата по Yookassa',
    description: 'Приложение для приёма платежей с помощью ЮКасса. Для использования необходимо установить API-ключ.',
    image: 'https://i.ibb.co/Hq6CJFj/Yookassa-Image.png',
    class: YookassaExtensionModule,
    extensionClass: YookassaExtension,
    schema: YookassaSchema,
    tags: ['платежи'],
    readme: getReadmeContent('./yookassa'),
    instructions: getInstructionsContent('./yookassa'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  sberpoll: {
    is_builtin: false,
    is_internal: true,
    availability: ExtensionAvailability.NOWHERE,
    desktops: undefined, // Это не desktop расширение
    title: 'Приём платежей на р/с в Сбере',
    description: 'Приложение для автоматического приёма паевых взносов в Сбербанке.',
    image: 'https://i.ibb.co/5rQTPLN/sber.png',
    class: SberpollExtensionModule,
    extensionClass: SberpollExtension,
    schema: SberpollSchema,
    tags: ['платежи'],
    readme: getReadmeContent('./sberpoll'),
    instructions: getInstructionsContent('./sberpoll'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  qrpay: {
    is_builtin: false,
    is_internal: true,
    availability: ExtensionAvailability.EVERYWHERE,
    desktops: undefined, // Это не desktop расширение
    title: 'Оплата по QR',
    description: 'Приложение для выставления QR-счёта на оплату из любого банковского приложения.',
    image: 'https://i.ibb.co/Y7pByhp/QR-Code-3.png',
    class: QrPayExtensionModule,
    extensionClass: QrPayExtension,
    schema: QRPaySchema,
    tags: ['платежи'],
    readme: getReadmeContent('./qrpay'),
    instructions: getInstructionsContent('./qrpay'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  chatcoop: {
    is_builtin: false,
    is_internal: true,
    availability: ExtensionAvailability.EVERYWHERE,
    desktops: [
      {
        name: 'chatcoop',
        title: 'Стол связи',
        icon: 'fa-solid fa-comments',
      },
    ],
    title: 'Стол связи',
    description: 'Приложения для общения и звонков между участниками кооперативной экономики.',
    image: 'https://i.ibb.co/3yWV8Wdp/Chat-GPT-Image-8-2025-22-45-36.png',
    class: ChatCoopExtensionModule,
    extensionClass: ChatCoopExtension,
    schema: ChatCoopSchema,
    tags: ['стол', 'общение'],
    readme: getReadmeContent('./chatcoop'),
    instructions: getInstructionsContent('./chatcoop'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  reports: {
    is_builtin: true,
    is_internal: true,
    availability: ExtensionAvailability.EVERYWHERE,
    desktops: [
      {
        name: 'reports',
        title: 'Стол бухгалтера',
        icon: 'fa-solid fa-file-invoice',
      },
    ],
    title: 'Стол бухгалтера',
    description: 'Двойная бухгалтерия кооператива: реестры операций, проводок, кошельков и счетов; календарь и формы налоговой отчётности (бухбаланс, 6-НДФЛ, РСВ, ПСВ, декларация УСН, уведомления ФНС).',
    image: 'https://i.ibb.co/6C5F3kD/Chat-GPT-Image-10-2025-20-42-42.png',
    class: ReportsExtensionModule,
    extensionClass: BuiltinExtension,
    schema: BuiltinSchema,
    tags: ['бухгалтерия', 'отчётность', 'ФНС'],
    readme: getReadmeContent('./reports'),
    instructions: getInstructionsContent('./reports'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  market: {
    is_builtin: false,
    is_internal: true,
    // Обкатка Стола заказов идёт на тестовом контуре; в основной сети приложение
    // остаётся закрытым, пока здесь не поставят EVERYWHERE.
    availability: ExtensionAvailability.NON_MAINNET_ONLY,
    // Расширение «Стол заказов» предоставляет ЧЕТЫРЕ рабочих стола, разнесённых
    // по ролям пайщика. Каждый `name` ОБЯЗАН совпадать с workspace из desktop
    // `extensions/market/install.ts`: фронт привязывает маршруты только к тем
    // workspace'ам, что объявлены здесь (desktop.interactor → DesktopStore.setRoutes).
    // Если стол не объявлен в этом списке — его маршруты молча теряются.
    // Видимость столов/страниц — канон авторизации (grants): backend
    // (MarketplaceDesktopGrantsProvider) выдаёт права текущему пользователю,
    // фронт сверяет с ними `meta.requires` маршрутов. До принятия ЦПП советом
    // у председателя только Extension:configure (страница подключения), у
    // остальных — пусто; после принятия — полный набор по ролям.
    desktops: [
      {
        name: 'market',
        title: 'Стол заказчика',
        icon: 'fa-solid fa-cart-shopping',
      },
      {
        name: 'market-supplier',
        title: 'Стол поставщика',
        icon: 'fa-solid fa-store',
      },
      {
        name: 'market-pvz',
        title: 'Стол ПВЗ',
        icon: 'fa-solid fa-map-location-dot',
      },
      {
        name: 'market-admin',
        title: 'Стол администратора',
        icon: 'fa-solid fa-shield-halved',
      },
    ],
    title: 'Стол заказов',
    description: 'Приложение для заказа и поставки имущества в кооперативе.',
    image: 'https://i.ibb.co/84SRvtR3/Chat-GPT-Image-15-2025-11-33-17.png',
    class: MarketplaceExtensionModule,
    extensionClass: MarketplaceExtension,
    schema: MarketplaceSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./marketplace'),
    instructions: getInstructionsContent('./marketplace'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
};
