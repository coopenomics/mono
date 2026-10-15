import dotenv from 'dotenv';
import { Mutations } from '@coopenomics/sdk';

// Загружаем переменные окружения из .env файла
dotenv.config();

// Используем готовые типы из SDK
export type CooperativeConfig = {
  organization_data: Mutations.System.InitSystem.IInput['data']['organization_data'];
};

// Скрипт для инициализации кооператива через server-secret
async function initCooperative() {
  try {
    console.log('🚀 Начинаем инициализацию кооператива...');

    // Получаем server_secret из переменных окружения
    const serverSecret = process.env.SERVER_SECRET;
    if (!serverSecret) {
      // i18n-ignore: SERVER_SECRET не найден в переменных окружения — ошибка конфигурации при старте, до пайщика не доходит
      throw new Error('SERVER_SECRET не найден в переменных окружения');
    }

    // Импортируем локальную конфигурацию
    const { initConfig } = await import('./init-config');
    const config: CooperativeConfig = initConfig;
    console.log('✅ Конфигурация загружена из локального файла');

    // Создаем GraphQL клиент аналогично desktop коду
    const { Client } = await import('@coopenomics/sdk');

    // Всегда используем локальный endpoint с server-secret
    const client = Client.create({
      api_url: 'http://localhost:2998/v1/graphql',
      headers: {
        'server-secret': serverSecret,
        'Content-Type': 'application/json',
      },
      chain_url: 'dummy',
      chain_id: 'dummy',
    });

    console.log('🔗 Подключено к GraphQL API');

    // Выполняем мутацию через SDK клиент
    const response = await client.Mutation(Mutations.System.InitSystem.mutation, {
      variables: {
        data: {
          organization_data: config.organization_data,
        },
      },
    });

    console.log('✅ Кооператив успешно инициализирован!');
    console.log('📊 Результат:', JSON.stringify(response, null, 2));
  } catch (error: any) {
    console.error('❌ Ошибка при инициализации кооператива:', error.message);

    if (error.response?.errors) {
      console.error('📋 Детали ошибки:', JSON.stringify(error.response.errors, null, 2));
    }

    process.exit(1);
  }
}

// Основная функция
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    console.log(`
❌ Скрипт не принимает аргументы!

🛠️  Init Cooperative Script - Инициализация кооператива через server-secret

📚 Использование:
  npm run init:cooperative

📋 Описание:
  Скрипт использует конфигурацию из src/scripts/example-config.ts
  Измените данные в этом файле перед запуском.

⚠️  Важно:
  - SERVER_SECRET должен быть установлен в переменных окружения (.env файл)
  - Всегда используется http://localhost:3000/graphql
  - Все поля в конфигурации обязательны для заполнения
  - Данные будут сохранены в системе и не смогут быть изменены
`);
    return;
  }

  // Запускаем инициализацию
  await initCooperative();
}

// Запуск скрипта
main().catch((error) => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
