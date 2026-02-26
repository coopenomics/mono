// ========== ./extensions.registry.ts ==========

import { PowerupPluginModule, PowerupPlugin, Schema as PowerupSchema } from './powerup/powerup-extension.module';
import { ChatCoopPluginModule, ChatCoopPlugin, Schema as ChatCoopSchema } from './chatcoop/chatcoop-extension.module';
import fs from 'node:fs/promises';
import { YookassaPluginModule, YookassaPlugin, Schema as YookassaSchema } from './yookassa/yookassa-extension.module';
import { SberpollPluginModule, SberpollPlugin, Schema as SberpollSchema } from './sberpoll/sberpoll-extension.module';
import { QrPayPluginModule, QrPayPlugin, Schema as QRPaySchema } from './qrpay/qrpay-extension.module';
import path from 'path';
import { BuiltinPluginModule, BuiltinPlugin, Schema as BuiltinSchema } from './builtin/builtin-extension.module';
import { ChairmanPluginModule, ChairmanPlugin, Schema as ChairmanSchema } from './chairman/chairman-extension.module';
import { ParticipantPluginModule } from './participant/participant-extension.module';
import { Schema as ParticipantSchema } from './participant/types';
import { OneCoopPluginModule, OneCoopPlugin, Schema as OneCoopSchema } from './1ccoop/oneccoop-extension.module';
import { CapitalPluginModule, CapitalPlugin, Schema as CapitalSchema } from './capital/capital-extension.module';
import { ReportsExtensionModule } from './reports/reports-extension.module';

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
 * Основной интерфейс для описания расширения в реестре.
 * Обрати внимание: сохраняем его тут, а не в домене, чтобы не тянуть поля readme, instructions и т.д. в домен.
 */
export interface IRegistryExtension {
  is_builtin: boolean; // признак, что расширение встроенное (?)
  is_available: boolean; // признак, что расширение доступно для установки
  is_internal: boolean; // признак, что расширение внутреннее
  desktops?: IDesktopConfig[]; // массив рабочих столов, которые предоставляет расширение
  external_url?: string; // ссылка на внешний ресурс
  title: string; // заголовок/название расширения
  description: string; // краткое описание
  image: string; // URL к изображению
  class: any; // класс модуля-расширения
  pluginClass: any; // класс плагина-расширения (для миграций схемы)
  schema: any; // Zod-схема (или другая), которая описывает конфиг
  tags?: string[]; // список тегов
  readme: Promise<string>; // README содержимое
  instructions: Promise<string>; // INSTALL содержимое

  // Для обратной совместимости: если есть desktops, значит это desktop расширение
  get is_desktop(): boolean;
}

interface INamedExtension {
  [key: string]: IRegistryExtension;
}

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
    is_available: true,
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
    class: BuiltinPluginModule,
    pluginClass: BuiltinPlugin,
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
    is_available: true,
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
    class: CapitalPluginModule,
    pluginClass: CapitalPlugin,
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
    is_available: true,
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
    class: ChairmanPluginModule,
    pluginClass: ChairmanPlugin,
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
    is_available: false,
    desktops: [
      {
        name: 'trustee',
        title: 'Стол Уполномоченного',
        icon: 'fa-solid fa-users-cog',
      },
    ],
    title: 'Стол Уполномоченного',
    description: 'Приложение для председателя кооперативного участка.',
    image: 'https://i.ibb.co/MxbHCqqf/Chat-GPT-Image-11-2025-18-26-44.png',
    class: BuiltinPluginModule,
    pluginClass: BuiltinPlugin,
    schema: BuiltinSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./yookassa'),
    instructions: getInstructionsContent('./yookassa'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  participant: {
    is_builtin: true,
    is_internal: true,
    is_available: true,
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
    class: ParticipantPluginModule,
    pluginClass: BuiltinPlugin, // Participant использует тот же BuiltinPlugin
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
    is_available: true,
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
    class: PowerupPluginModule,
    pluginClass: PowerupPlugin,
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
    is_available: false,
    desktops: undefined, // Это не desktop расширение
    title: 'YOOKASSA',
    description: 'Приложение для приёма платежей с помощью ЮКасса. Для использования необходимо установить API-ключ.',
    image: 'https://i.ibb.co/Hq6CJFj/Yookassa-Image.png',
    class: YookassaPluginModule,
    pluginClass: YookassaPlugin,
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
    is_available: false,
    desktops: undefined, // Это не desktop расширение
    title: 'SBERKASSA',
    description: 'Приложение для автоматического приёма паевых взносов в Сбербанке.',
    image: 'https://i.ibb.co/5rQTPLN/sber.png',
    class: SberpollPluginModule,
    pluginClass: SberpollPlugin,
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
    is_available: true,
    desktops: undefined, // Это не desktop расширение
    title: 'QR-CODE',
    description: 'Приложение для выставления QR-счёта на оплату из любого банковского приложения.',
    image: 'https://i.ibb.co/Y7pByhp/QR-Code-3.png',
    class: QrPayPluginModule,
    pluginClass: QrPayPlugin,
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
    is_available: true,
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
    class: ChatCoopPluginModule,
    pluginClass: ChatCoopPlugin,
    schema: ChatCoopSchema,
    tags: ['стол', 'общение'],
    readme: getReadmeContent('./chatcoop'),
    instructions: getInstructionsContent('./chatcoop'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  onecoop: {
    is_builtin: false,
    is_internal: true,
    is_available: true,
    desktops: undefined, // Это не desktop расширение
    title: 'Интеграция 1С',
    description: 'Приложение для синхронизации документов кооператива с внешней бухгалтерией 1С.',
    image: 'https://foni.papik.pro/uploads/posts/2024-10/foni-papik-pro-avs3-p-kartinki-logo-1s-na-prozrachnom-fone-23.png',
    class: OneCoopPluginModule,
    pluginClass: OneCoopPlugin,
    schema: OneCoopSchema,
    tags: ['интеграция', 'бухгалтерия', '1с'],
    readme: getReadmeContent('./1ccoop'),
    instructions: getInstructionsContent('./1ccoop'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  reports: {
    is_builtin: false,
    is_internal: true,
    is_available: true,
    desktops: [
      {
        name: 'reports',
        title: 'Отчёты ФНС',
        icon: 'fa-solid fa-file-invoice',
      },
    ],
    title: 'Отчёты ФНС',
    description: 'Генерация налоговых отчётов для ФНС: бухбаланс, 6-НДФЛ, РСВ, ПСВ, декларация УСН и уведомления.',
    image: 'https://i.ibb.co/6C5F3kD/Chat-GPT-Image-10-2025-20-42-42.png',
    class: ReportsExtensionModule,
    pluginClass: BuiltinPlugin,
    schema: BuiltinSchema,
    tags: ['бухгалтерия', 'отчётность', 'ФНС'],
    readme: getReadmeContent('./reports'),
    instructions: getInstructionsContent('./reports'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
  orders: {
    is_builtin: false,
    is_internal: true,
    is_available: false,
    desktops: [
      {
        name: 'orders',
        title: 'Стол заказов',
        icon: 'fa-solid fa-shopping-cart',
      },
    ],
    title: 'Стол заказов',
    description: 'Приложение для заказа и поставки имущества в кооперативе.',
    image: 'https://i.ibb.co/84SRvtR3/Chat-GPT-Image-15-2025-11-33-17.png',
    class: BuiltinPluginModule,
    pluginClass: BuiltinPlugin,
    schema: BuiltinSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./orders'),
    instructions: getInstructionsContent('./orders'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
};
