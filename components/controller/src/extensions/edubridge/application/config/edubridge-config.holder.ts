import { Injectable } from '@nestjs/common';
import { defaultConfig, type IConfig } from '../../types';

/**
 * Текущий конфиг расширения в памяти. Заполняется при `initialize()` и при
 * обновлении настроек; сервисам не нужно ходить в репозиторий за флагами.
 */
@Injectable()
export class EdubridgeConfigHolder {
  private current: IConfig = defaultConfig;

  set(config: IConfig): void {
    this.current = config;
  }

  get(): IConfig {
    return this.current;
  }
}
