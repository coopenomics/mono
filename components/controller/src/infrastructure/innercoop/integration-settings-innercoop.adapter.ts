import { Injectable } from '@nestjs/common';
import type { IIntegrationSettingsPort } from '@coopenomics/innercoop';
import config from '~/config/config';

/**
 * Какие внешние службы разрешены каким расширениям.
 *
 * Список ведётся здесь, в composition root: он и есть то самое место, которому
 * позволено знать обе стороны. Новое расширение, которому нужна служба,
 * добавляется сюда явно — молча получить чужой ключ нельзя.
 */
const ALLOWED_INTEGRATIONS: Readonly<Record<string, readonly string[]>> = {
  chatcoop: ['matrix', 'openai', 'livekit', 'union'],
  marketplace: ['geocoder'],
  capital: ['github'],
};

/** Настройки служб контура. Ключи и адреса задаются при развёртывании. */
const INTEGRATION_SETTINGS: Readonly<Record<string, unknown>> = {
  matrix: config.matrix,
  openai: config.openai,
  livekit: config.livekit,
  union: config.union,
  geocoder: config.geocoder,
  github: config.github,
};

/**
 * Реализация `IIntegrationSettingsPort`.
 *
 * Отдаёт настройку только тому расширению, которому эта служба разрешена.
 * Неразрешённая и ненастроенная служба неразличимы снаружи намеренно: в обоих
 * случаях расширение обязано работать без неё, а различие подсказало бы, что
 * ключ существует.
 */
@Injectable()
export class IntegrationSettingsInnercoopAdapter implements IIntegrationSettingsPort {
  get<T = Record<string, any>>(extensionName: string, integration: string): T | null {
    const allowed = ALLOWED_INTEGRATIONS[extensionName];
    if (!allowed?.includes(integration)) {
      return null;
    }
    return (INTEGRATION_SETTINGS[integration] as T) ?? null;
  }
}
