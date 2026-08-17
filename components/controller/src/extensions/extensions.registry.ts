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

import { capitalEntities } from './capital/capital.entities';
import { chairmanEntities } from './chairman/chairman.entities';
import { chatcoopEntities } from './chatcoop/chatcoop.entities';
import { expensesEntities } from './expenses/expenses.entities';
import { kuEntities } from './ku/ku.entities';
import { marketplaceEntities } from './marketplace/marketplace.entities';
import { reportsEntities } from './reports/reports.entities';

import { chatcoopMigrations } from './chatcoop/chatcoop.migrations';
import { marketplaceMigrations } from './marketplace/marketplace.migrations';
import { powerupMigrations } from './powerup/powerup.migrations';

import { builtinPorts } from './builtin/builtin.ports';
import { capitalPorts } from './capital/capital.ports';
import { chairmanPorts } from './chairman/chairman.ports';
import { chatcoopPorts } from './chatcoop/chatcoop.ports';
import { kuPorts } from './ku/ku.ports';
import { marketplacePorts } from './marketplace/marketplace.ports';
import { participantPorts } from './participant/participant.ports';
import { powerupPorts } from './powerup/powerup.ports';
import { qrpayPorts } from './qrpay/qrpay.ports';
import { reportsPorts } from './reports/reports.ports';
import { sberpollPorts } from './sberpoll/sberpoll.ports';
import { yookassaPorts } from './yookassa/yookassa.ports';

import { defaultConfig as builtinDefaultConfig } from './builtin/builtin-extension.module';
import { defaultConfig as chairmanDefaultConfig } from './chairman/chairman-extension.module';
import { defaultConfig as powerupDefaultConfig } from './powerup/powerup-extension.module';
import { defaultConfig as qrpayDefaultConfig } from './qrpay/qrpay-extension.module';
import { defaultConfig as sberpollDefaultConfig } from './sberpoll/sberpoll-extension.module';
import { defaultConfig as yookassaDefaultConfig } from './yookassa/yookassa-extension.module';

import {
  ExtensionAvailability,
  ExtensionConfigSuppliedBy,
  isExtensionAvailable,
  registerExtensionEntities,
  type IRegistryExtension,
} from '@coopenomics/extension-kit';

// Форма записи реестра, enum доступности и её вычисление живут в @coopenomics/extension-kit —
// расширению нужен этот контракт, чтобы типизировать свою запись. Здесь остаётся сам реестр:
// перечисление конкретных расширений, то есть composition root.

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
    defaults: { enabled: true, config: builtinDefaultConfig },
    schema: BuiltinSchema,
    ports: builtinPorts,
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
    entities: capitalEntities,
    ports: capitalPorts,
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
    entities: chairmanEntities,
    defaults: { enabled: true, config: chairmanDefaultConfig },
    ports: chairmanPorts,
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
    entities: kuEntities,
    ports: kuPorts,
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
    defaults: { enabled: true, config: builtinDefaultConfig },
    schema: ParticipantSchema,
    ports: participantPorts,
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
    migrations: powerupMigrations,
    defaults: { enabled: true, config: powerupDefaultConfig },
    ports: powerupPorts,
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
    defaults: { enabled: false, config: yookassaDefaultConfig },
    ports: yookassaPorts,
    schema: YookassaSchema,
    // Реквизиты магазина ЮKassa принадлежат кооперативу, но значением наружу не
    // уходят: `getExtensions` отдаёт «задано»/«не задано». До этого секретный
    // ключ кассы возвращался председателю в открытом виде.
    configPolicy: {
      client: { secret: true, suppliedBy: ExtensionConfigSuppliedBy.COOPERATIVE },
      secret: { secret: true, suppliedBy: ExtensionConfigSuppliedBy.COOPERATIVE },
    },
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
    defaults: { enabled: false, config: sberpollDefaultConfig },
    ports: sberpollPorts,
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
    defaults: { enabled: true, config: qrpayDefaultConfig },
    ports: qrpayPorts,
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
    entities: chatcoopEntities,
    migrations: chatcoopMigrations,
    ports: chatcoopPorts,
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
    entities: reportsEntities,
    ports: reportsPorts,
    defaults: { enabled: true, config: builtinDefaultConfig },
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
    entities: marketplaceEntities,
    migrations: marketplaceMigrations,
    ports: marketplacePorts,
    schema: MarketplaceSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./marketplace'),
    instructions: getInstructionsContent('./marketplace'),
    get is_desktop() {
      return !!this.desktops && this.desktops.length > 0;
    },
  },
};

/**
 * Состав таблиц установленных расширений — то, что уходит в подключение к базе.
 *
 * Собирается из деклараций самих расширений, а не из положения файлов на диске:
 * расширение, установленное пакетом, ни под какой глоб по `src/` не попадёт.
 * Одно и то же расширение может стоять в реестре несколькими записями (у
 * встроенных на один модуль приходится несколько столов), поэтому список
 * схлопывается по классу.
 *
 * Шасси расходов витрины не имеет и записи в реестре тоже: пайщик его не
 * ставит, оно обслуживает другие расширения. Таблицы у него при этом свои,
 * поэтому оно перечислено отдельно.
 */
registerExtensionEntities([
  ...new Set([...Object.values(AppRegistry).flatMap((extension) => extension.entities ?? []), ...expensesEntities]),
]);
