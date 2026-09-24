import fs from 'fs';
import path from 'path';
import { migrationTimestamp, parseMigrationFilename } from '../migrator/migration-filename';

// Получаем аргументы командной строки
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Использование: pnpm migration:generate <migration_name>');
  console.error('Пример: pnpm migration:generate backfill_member_since');
  console.error('Схему (таблицы, колонки, индексы) меняет pnpm schema:generate, а не эта команда.');
  process.exit(1);
}

const migrationName = args[0];

// Имя файла — метка времени создания (UTC, до минуты): номер не вычисляется от
// предыдущего файла, и параллельные ветки не получают один и тот же ключ.
// См. src/migrator/migration-filename.ts.
const migrationsDir = path.join(__dirname, '../../migrations');
const fileName = `${migrationTimestamp()}__${migrationName}.ts`;
const filePath = path.join(migrationsDir, fileName);
if (fs.existsSync(filePath)) {
  console.error(`Файл ${fileName} уже есть — подождите минуту или дайте другое имя`);
  process.exit(1);
}
parseMigrationFilename(fileName);

// Шаблон миграции
// i18n-ignore: шаблон генерируемого файла миграции — исходный код, не текст интерфейса
const template = `import { DataSource } from 'typeorm';
import config from '../src/config/config';

export default {
  name: '${migrationName.replace(/_/g, ' ')}',

  async up({ dataSource, blockchain, logger }: { dataSource: any; blockchain: any; logger: any }): Promise<boolean> {
    console.log('Выполнение миграции: ${migrationName.replace(/_/g, ' ')}');

    try {
      console.log('Используем существующее подключение к PostgreSQL');

      // TODO: Добавить SQL команды для миграции

      console.log('Миграция завершена: ${migrationName.replace(/_/g, ' ')} успешно');
      return true;
    } catch (error) {
      console.error('Ошибка при выполнении миграции:', error);
      return false;
    }
  },

  async down({ dataSource, blockchain, logger }: { dataSource: any; blockchain: any; logger: any }): Promise<boolean> {
    console.log('Откат миграции: ${migrationName.replace(/_/g, ' ')}');

    try {
      console.log('Используем существующее подключение к PostgreSQL для отката');

      // TODO: Добавить SQL команды для отката

      console.log('Откат миграции завершен: ${migrationName.replace(/_/g, ' ')} успешно');
      return true;
    } catch (error) {
      console.error('Ошибка при откате миграции:', error);
      return false;
    }
  },
};
`;

// Создаем файл
fs.writeFileSync(filePath, template);

console.log(`✅ Миграция создана: ${fileName}`);
console.log(`📁 Путь: ${filePath}`);
console.log('\n📝 Не забудьте:');
console.log('1. Заполнить методы up() и down() командами (dataSource, blockchain, logger доступны)');
console.log('2. Протестировать миграцию: npm run migration:run');
console.log('3. Проверить откат: npm run migration:rollback');
