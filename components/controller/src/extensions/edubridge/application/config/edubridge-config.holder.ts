import { Inject, Injectable } from '@nestjs/common';
import { merge } from 'lodash';
import { EXTENSION_CONFIG_PORT, type IExtensionConfigPort } from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { defaultConfig, type IConfig } from '../../types';

/** Как долго верить конфигу в памяти, прежде чем перечитать из хранилища. */
const TTL_MS = 10_000;

/**
 * Текущий конфиг расширения. `load()` — свежий (с коротким кэшем), для
 * асинхронных путей: гранты стола, guard резолверов. `get()` — последний
 * известный, для синхронных политик (фильтр витрины вступления).
 */
@Injectable()
export class EdubridgeConfigHolder {
  private current: IConfig = defaultConfig;
  private loadedAt = 0;
  /** Расширение установлено и включено. До первого чтения — нет: умолчания настройки не решение кооператива. */
  private enabled = false;

  constructor(@Inject(EXTENSION_CONFIG_PORT) private readonly configPort: IExtensionConfigPort) {}

  /** Настройку задаёт запущенное расширение — значит, оно установлено и включено. */
  set(config: IConfig): void {
    this.current = config;
    this.enabled = true;
    this.loadedAt = Date.now();
  }

  /** Последнее известное: работает ли расширение в кооперативе. */
  isEnabled(): boolean {
    return this.enabled;
  }

  get(): IConfig {
    return this.current;
  }

  async load(): Promise<IConfig> {
    if (Date.now() - this.loadedAt < TTL_MS) return this.current;
    const [stored, enabled] = await Promise.all([
      this.configPort.get<Partial<IConfig>>(EDUBRIDGE_EXTENSION_NAME),
      this.configPort.isEnabled(EDUBRIDGE_EXTENSION_NAME),
    ]);
    if (stored) this.current = merge({}, defaultConfig, stored);
    this.enabled = enabled;
    this.loadedAt = Date.now();
    return this.current;
  }
}
