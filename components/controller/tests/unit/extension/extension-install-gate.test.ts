/**
 * Гейт установки обязан жить на сервере: скрытая карточка в интерфейсе не мешает
 * вызвать мутацию installExtension напрямую.
 */
const chainConfig = { is_mainnet: true };

// Подменяем только сеть, остальное берём из настоящего конфига (он валиден
// благодаря tests/setup-env.ts): реестр расширений тянет модули, читающие
// config.postgres/config.blockchain на верхнем уровне, и от урезанного объекта
// весь сьют падает ещё на импорте.
jest.mock('~/config/config', () => {
  const actual = jest.requireActual('~/config/config').default;
  return {
    __esModule: true,
    default: {
      ...actual,
      get blockchain() {
        return { ...actual.blockchain, ...chainConfig };
      },
    },
  };
});

import { ExtensionDomainListingService } from '~/domain/extension/services/extension-listing-domain.service';

describe('ExtensionDomainListingService.assertInstallable', () => {
  let service: ExtensionDomainListingService;

  beforeEach(() => {
    service = new ExtensionDomainListingService({} as any);
  });

  it('в основной сети Стол заказов ставить запрещено', () => {
    chainConfig.is_mainnet = true;
    expect(() => service.assertInstallable('market')).toThrow('недоступно для установки');
  });

  it('вне основной сети Стол заказов ставить разрешено', () => {
    chainConfig.is_mainnet = false;
    expect(() => service.assertInstallable('market')).not.toThrow();
  });

  it('расширение, открытое везде, ставится и в основной сети', () => {
    chainConfig.is_mainnet = true;
    expect(() => service.assertInstallable('capital')).not.toThrow();
  });

  it('закрытое расширение не ставится даже на тестовом контуре', () => {
    chainConfig.is_mainnet = false;
    expect(() => service.assertInstallable('yookassa')).toThrow('недоступно для установки');
  });

  it('неизвестное имя отвергается', () => {
    expect(() => service.assertInstallable('nonexistent')).toThrow('не найдено в реестре');
  });
});
