import { Injectable } from '@nestjs/common';
import { ProviderPort } from './ports/provider.port';

/**
 * Реестр платёжных провайдеров: расширение кладёт сюда свою реализацию при
 * запуске, шлюз достаёт её по имени при обработке платежа.
 *
 * Порт реализуется прямо здесь. Раньше между ними стоял адаптер, пробрасывавший
 * два метода один в один, — лишнее звено того же рода, из-за которого
 * инфраструктура шлюза знала про приложение.
 */
@Injectable()
export class ProviderDomainService implements ProviderPort {
  private providers: Record<string, any> = {};

  registerProvider(name: string, providerInstance: any) {
    this.providers[name] = providerInstance;
  }

  getProvider(name: string) {
    return this.providers[name];
  }
}
