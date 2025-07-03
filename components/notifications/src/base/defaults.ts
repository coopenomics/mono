import { PreferencesConfig, ChannelsConfig, ChannelConfig } from '../types';

// Базовая конфигурация канала
export const createChannelConfig = (enabled: boolean, readOnly = false): ChannelConfig => ({
  enabled,
  readOnly,
});

// Базовая конфигурация каналов
export const createDefaultChannelsConfig = (): ChannelsConfig => ({
  email: createChannelConfig(true),
  sms: createChannelConfig(false),
  in_app: createChannelConfig(true),
  push: createChannelConfig(false),
  chat: createChannelConfig(false),
});

// Базовые preferences для воркфлоу
export const createDefaultPreferences = (): PreferencesConfig => ({
  user: {
    all: createChannelConfig(true),
    channels: createDefaultChannelsConfig(),
  },
  workflow: {
    all: createChannelConfig(true),
    channels: createDefaultChannelsConfig(),
  },
});

// Вспомогательные функции для создания шагов
export const createEmailStep = (name: string, subject: string, body: string) => ({
  name,
  type: 'email' as const,
  controlValues: {
    subject,
    body,
    editorType: 'html' as const,
  },
});

export const createInAppStep = (name: string, subject: string, body: string, avatar?: string) => ({
  name,
  type: 'in_app' as const,
  controlValues: {
    subject,
    body,
    avatar: avatar || 'https://novu.coopenomics.world/images/bell.svg',
  },
});

export const createPushStep = (name: string, title: string, body: string) => ({
  name,
  type: 'push' as const,
  controlValues: {
    subject: title,
    body,
  },
});

export const createSmsStep = (name: string, body: string) => ({
  name,
  type: 'sms' as const,
  controlValues: {
    body,
  },
});
