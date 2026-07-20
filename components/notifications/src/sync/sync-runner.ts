#!/usr/bin/env node

import { NovuSyncService } from './novu-sync.service';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// Конфигурация из переменных окружения
const config = {
  apiKey: process.env.NOVU_API_KEY || '',
  apiUrl: process.env.NOVU_API_URL || '',
};

async function runSync() {
  console.log('🔄 Запуск синхронизации воркфлоу...');
  
  try {
    // Проверяем конфигурацию
    if (!config.apiKey) {
      throw new Error('❌ NOVU_API_KEY не установлен в переменных окружения');
    }
    
    if (!config.apiUrl) {
      throw new Error('❌ NOVU_API_URL не установлен в переменных окружения');
    }
    
    const syncService = new NovuSyncService(config);
    await syncService.upsertAllWorkflows();
    console.log('✅ Синхронизация завершена успешно');
    return true;
  } catch (error: any) {
    console.error('❌ Ошибка синхронизации:', error.message);
    
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDev = args.includes('--dev') || process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log('📡 Режим разработки: отслеживаем изменения...');
    
    // Запускаем синхронизацию сразу
    const initialSyncSuccess = await runSync();
    
    if (!initialSyncSuccess) {
      console.error('❌ Первоначальная синхронизация не удалась');
      process.exit(1);
    }
    
    // Отслеживаем изменения в файлах воркфлоу и типов
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const workflowsPath = join(__dirname, '../workflows');
    const typesPath = join(__dirname, '../types');
    
    const watchPaths = [];
    if (existsSync(workflowsPath)) {
      watchPaths.push(workflowsPath);
    }
    if (existsSync(typesPath)) {
      watchPaths.push(typesPath);
    }
    
    if (watchPaths.length > 0) {
      console.log('👀 Отслеживаем изменения в:', watchPaths.join(', '));

      const { watch } = await import('chokidar');
      
      let syncTimeout: NodeJS.Timeout | null = null;
      
      const watcher = watch(watchPaths, {
        ignored: /node_modules/,
        persistent: true,
        ignoreInitial: true,
      });
      
      watcher.on('change', (path: string) => {
        console.log(`📝 Изменен файл: ${path}`);
        
        // Дебаунс для избежания множественных запусков
        if (syncTimeout) {
          clearTimeout(syncTimeout);
        }
        
        syncTimeout = setTimeout(async () => {
          console.log('⏰ Запускаем синхронизацию...');
          const success = await runSync();
          if (!success) {
            console.error('⚠️  Синхронизация не удалась, но продолжаем отслеживание...');
          }
        }, 1000);
      });
      
      watcher.on('add', (path: string) => {
        console.log(`➕ Добавлен файл: ${path}`);
        if (syncTimeout) {
          clearTimeout(syncTimeout);
        }
        syncTimeout = setTimeout(async () => {
          console.log('⏰ Запускаем синхронизацию...');
          const success = await runSync();
          if (!success) {
            console.error('⚠️  Синхронизация не удалась, но продолжаем отслеживание...');
          }
        }, 1000);
      });
      
      watcher.on('unlink', (path: string) => {
        console.log(`➖ Удален файл: ${path}`);
        if (syncTimeout) {
          clearTimeout(syncTimeout);
        }
        syncTimeout = setTimeout(async () => {
          console.log('⏰ Запускаем синхронизацию...');
          const success = await runSync();
          if (!success) {
            console.error('⚠️  Синхронизация не удалась, но продолжаем отслеживание...');
          }
        }, 1000);
      });
      
      console.log('💡 Нажмите Ctrl+C для выхода');
      
      // Держим процесс живым
      process.on('SIGINT', () => {
        console.log('\n👋 Выход из режима разработки');
        watcher.close();
        process.exit(0);
      });
    } else {
      console.log('⚠️  Папки для отслеживания не найдены');
      process.exit(1);
    }
    
  } else {
    // Production режим - запускаем один раз
    const success = await runSync();
    process.exit(success ? 0 : 1);
  }
}

// Проверяем, запущен ли файл как основной модуль
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });
}

export { runSync, NovuSyncService }; 