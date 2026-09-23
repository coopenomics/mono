/**
 * Тексты уведомлений по языкам.
 *
 * Словарь — `./<язык>.json`: по имени сценария (каталог в camelCase) лежат
 * `name`, `description` и шаблоны каналов `email`/`inApp`/`push`/`sms` с полями
 * `subject`/`body`. Шаблоны — Liquid (`{{ payload.x }}`, `{% if %}`), не формат
 * vue-i18n: их отрисовывает контроллер при отправке.
 *
 * Сценарий берёт русский текст через `nt()` при описании — шаги несут текст
 * языка по умолчанию, как и раньше. Текст на другом языке контроллер находит
 * по `i18nKey` сценария (`templateFor`).
 */
import ru from './ru.json';

type Channel = 'email' | 'inApp' | 'push' | 'sms';

interface ChannelTemplate {
  subject?: string;
  body?: string;
}

type WorkflowTexts = { name?: string; description?: string } & Partial<Record<Channel, ChannelTemplate>>;

export const DEFAULT_NOTIFICATION_LOCALE = 'ru';

export const notificationTemplates: Record<string, Record<string, WorkflowTexts>> = {
  ru: ru as Record<string, WorkflowTexts>,
};

function lookup(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);
}

/** Текст по ключу `<сценарий>.<поле>` на языке по умолчанию. */
export function nt(key: string): string {
  const value = lookup(notificationTemplates[DEFAULT_NOTIFICATION_LOCALE], key);
  if (typeof value !== 'string') throw new Error(`notifications i18n: нет текста «${key}»`);
  return value;
}

const CHANNEL_KEY: Record<string, Channel> = { email: 'email', in_app: 'inApp', push: 'push', sms: 'sms' };

/**
 * Шаблон канала сценария на языке `locale`; нет перевода — undefined, и
 * вызывающий берёт текст шага (язык по умолчанию).
 */
export function templateFor(i18nKey: string, channel: string, locale: string): ChannelTemplate | undefined {
  const channelKey = CHANNEL_KEY[channel];
  if (!channelKey) return undefined;
  return notificationTemplates[locale]?.[i18nKey]?.[channelKey];
}
