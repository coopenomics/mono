// ========== ./extensions.registry.ts ==========

import { PowerupPluginModule, Schema as PowerupSchema } from './powerup/powerup-extension.module';
import fs from 'node:fs/promises';
import { YookassaPluginModule, Schema as YookassaSchema } from './yookassa/yookassa-extension.module';
import { SberpollPluginModule, Schema as SberpollSchema } from './sberpoll/sberpoll-extension.module';
import { QrPayPluginModule, Schema as QRPaySchema } from './qrpay/qrpay-extension.module';
import path from 'path';
import { BuiltinPluginModule, Schema as BuiltinSchema } from './builtin/builtin-extension.module';
import { ChairmanPluginModule, Schema as ChairmanSchema } from './chairman/chairman-extension.module';
import { ParticipantPluginModule } from './participant/participant-extension.module';
import { Schema as ParticipantSchema } from './participant/types';
/**
 * Основной интерфейс для описания расширения в реестре.
 * Обрати внимание: сохраняем его тут, а не в домене, чтобы не тянуть поля readme, instructions и т.д. в домен.
 */
export interface IRegistryExtension {
  is_builtin: boolean; // признак, что расширение встроенное (?)
  is_available: boolean; // признак, что расширение доступно для установки
  is_internal: boolean; // признак, что расширение внутреннее
  is_desktop: boolean; //признак, что расширение это рабочий стол
  external_url?: string; // ссылка на внешний ресурс
  title: string; // заголовок/название расширения
  description: string; // краткое описание
  image: string; // URL к изображению
  class: any; // класс модуля-расширения
  schema: any; // Zod-схема (или другая), которая описывает конфиг
  tags?: string[]; // список тегов
  readme: Promise<string>; // README содержимое
  instructions: Promise<string>; // INSTALL содержимое
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
    is_desktop: true,
    title: 'Стол Совета',
    description: 'Расширение для управления решениями в кооперативе.',
    image: 'https://i.ibb.co/Q3NmVvzN/Chat-GPT-Image-10-2025-20-40-44.png',
    class: BuiltinPluginModule,
    schema: BuiltinSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./yookassa'),
    instructions: getInstructionsContent('./yookassa'),
  },
  contributor: {
    is_builtin: false,
    is_internal: true,
    is_available: false,
    is_desktop: true,
    title: 'Стол Вкладчика',
    description: 'Расширение для управления интеллектуальными и имущественными вкладами по целевой программе "Благорост".',
    image: 'https://i.ibb.co/HRW1nFY/Chat-GPT-Image-10-2025-20-40-57.png',
    class: BuiltinPluginModule,
    schema: BuiltinSchema,
    tags: ['стол', 'управление', 'благорост'],
    readme: getReadmeContent('./yookassa'),
    instructions: getInstructionsContent('./yookassa'),
  },
  chairman: {
    is_builtin: true,
    is_internal: true,
    is_available: true,
    is_desktop: true,
    title: 'Стол Председателя',
    description: 'Расширение для председателя совета кооператива.',
    image: 'https://i.ibb.co/6C5F3kD/Chat-GPT-Image-10-2025-20-42-42.png',
    class: ChairmanPluginModule,
    schema: ChairmanSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./chairman'),
    instructions: getInstructionsContent('./chairman'),
  },
  trustee: {
    is_builtin: true,
    is_internal: true,
    is_available: false,
    is_desktop: true,
    title: 'Стол Уполномоченного',
    description: 'Расширение для председателя кооперативного участка.',
    image: 'https://i.ibb.co/MxbHCqqf/Chat-GPT-Image-11-2025-18-26-44.png',
    class: BuiltinPluginModule,
    schema: BuiltinSchema,
    tags: ['стол', 'управление'],
    readme: getReadmeContent('./yookassa'),
    instructions: getInstructionsContent('./yookassa'),
  },
  participant: {
    is_builtin: true,
    is_internal: true,
    is_available: true,
    is_desktop: true,
    title: 'Стол Пайщика',
    description: 'Расширение для управления персональным членством пайщика в кооперативе и отслеживания общих собраний.',
    image: 'https://i.ibb.co/gFHMX4s9/Chat-GPT-Image-11-2025-18-17-27.png',
    class: ParticipantPluginModule,
    schema: ParticipantSchema,
    tags: ['стол', 'управление', 'уведомления'],
    readme: getReadmeContent('./participant'),
    instructions: getInstructionsContent('./participant'),
  },
  powerup: {
    is_builtin: false,
    is_internal: true,
    is_available: true,
    is_desktop: false,
    title: 'QUOTTER',
    description: 'Расширение для автоматической аренды квот вычислительных ресурсов.',
    image: 'https://i.ibb.co/7np8Bpm/DALL-E-Futuristic-Robot-Art-Nouveau.webp',
    class: PowerupPluginModule,
    schema: PowerupSchema,
    tags: ['утилиты'],
    readme: getReadmeContent('./powerup'),
    instructions: getInstructionsContent('./powerup'),
  },
  yookassa: {
    is_builtin: false,
    is_internal: true,
    is_available: false,
    is_desktop: false,
    title: 'YOOKASSA',
    description: 'Расширение для приёма платежей с помощью ЮКасса. Для использования необходимо установить API-ключ.',
    image: 'https://i.ibb.co/Hq6CJFj/Yookassa-Image.png',
    class: YookassaPluginModule,
    schema: YookassaSchema,
    tags: ['платежи'],
    readme: getReadmeContent('./yookassa'),
    instructions: getInstructionsContent('./yookassa'),
  },
  sberpoll: {
    is_builtin: false,
    is_internal: true,
    is_available: false,
    is_desktop: false,
    title: 'SBERKASSA',
    description: 'Расширение для автоматического приёма паевых взносов в Сбербанке.',
    image: 'https://i.ibb.co/5rQTPLN/sber.png',
    class: SberpollPluginModule,
    schema: SberpollSchema,
    tags: ['платежи'],
    readme: getReadmeContent('./sberpoll'),
    instructions: getInstructionsContent('./sberpoll'),
  },
  qrpay: {
    is_builtin: false,
    is_internal: true,
    is_available: true,
    is_desktop: false,
    title: 'QR-CODE',
    description: 'Расширение для выставления QR-счёта на оплату из любого банковского приложения.',
    image: 'https://i.ibb.co/Y7pByhp/QR-Code-3.png',
    class: QrPayPluginModule,
    schema: QRPaySchema,
    tags: ['платежи'],
    readme: getReadmeContent('./qrpay'),
    instructions: getInstructionsContent('./qrpay'),
  },
};
