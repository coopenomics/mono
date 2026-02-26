import { z } from 'zod';

// Конфигурация для расширения marketplace
export interface IConfig {
  enabled: boolean;
  lastSyncTimestamp: string;
  // categorySyncEnabled: boolean;
  // attributeSyncEnabled: boolean;
  debug: boolean;
}

// Дефолтные параметры конфигурации
export const defaultConfig: IConfig = {
  enabled: true,
  lastSyncTimestamp: '',
  // categorySyncEnabled: true,
  // attributeSyncEnabled: true,
  debug: false,
};

// Схема валидации конфигурации
export const Schema = z.object({
  enabled: z.boolean().default(true),
  lastSyncTimestamp: z.string().default(''),
  // categorySyncEnabled: z.boolean().default(true),
  // attributeSyncEnabled: z.boolean().default(true),
  debug: z.boolean().default(false),
});
