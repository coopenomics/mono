/**
 * Capability-заявка расширения (ADR-16) проверяется при запуске.
 *
 * Смысл проверки — не в правах пайщика: их расширение проверяет само, на
 * границе своего API. Здесь другой вопрос — что расширению вообще позволено
 * просить у кооператива, и получает ли оно это. Без обязательного порта
 * расширение всё равно упало бы, но позже: в середине пользовательского
 * сценария и с ошибкой DI, по которой не видно, чего не хватает.
 */
import { ExtensionLifecycleDomainService } from '~/domain/extension/services/extension-lifecycle-domain.service';
import { AppRegistry } from '~/extensions/extensions.registry';

const REQUIRED = Symbol.for('Innercoop.CorePort.Test.Required');
const OPTIONAL = Symbol.for('Innercoop.CorePort.Test.Optional');

type Resolver = { get: jest.Mock; resolve: jest.Mock };

/**
 * Сервис с подменённым DI. Порты из `provided` резолвятся, остальные — нет;
 * `transient` отвечает только через `resolve`, как настоящий логгер с
 * `Scope.TRANSIENT`.
 */
function createService(provided: symbol[], transient: symbol[] = []) {
  const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(), setContext: jest.fn() };

  const moduleRef: Resolver = {
    get: jest.fn((token: symbol) => {
      if (transient.includes(token)) throw new Error('scoped provider');
      if (provided.includes(token)) return {};
      throw new Error('not found');
    }),
    resolve: jest.fn(async (token: symbol) => {
      if (transient.includes(token) || provided.includes(token)) return {};
      throw new Error('not found');
    }),
  };

  const service = new ExtensionLifecycleDomainService(
    {} as any,
    {} as any,
    logger as any,
    { emit: jest.fn() } as any,
    moduleRef as any
  );

  return { service, logger, moduleRef };
}

/** Проверка приватная — вызывается изнутри runApp; дёргаем её напрямую. */
const assertPorts = (service: ExtensionLifecycleDomainService, ports: unknown) =>
  (service as any).assertRequestedPortsAvailable('тестовое расширение', ports);

describe('Запуск расширения сверяется с его capability-заявкой', () => {
  it('обязательный порт есть — расширение запускается', async () => {
    const { service } = createService([REQUIRED]);

    await expect(assertPorts(service, { required: [REQUIRED], optional: [] })).resolves.toBeUndefined();
  });

  it('обязательного порта нет — отказ с названием порта в причине', async () => {
    const { service } = createService([]);

    await expect(assertPorts(service, { required: [REQUIRED], optional: [] })).rejects.toThrow(
      /Innercoop\.CorePort\.Test\.Required/
    );
  });

  it('порт с областью видимости считается предоставленным', async () => {
    // Логгер объявлен транзиентным: `setContext` мутирует инстанс, поэтому
    // каждый потребитель получает свой. `get` такие провайдеры не отдаёт.
    const { service } = createService([], [REQUIRED]);

    await expect(assertPorts(service, { required: [REQUIRED], optional: [] })).resolves.toBeUndefined();
  });

  it('необязательного порта нет — предупреждение, а не отказ', async () => {
    const { service, logger } = createService([REQUIRED]);

    await expect(
      assertPorts(service, { required: [REQUIRED], optional: [OPTIONAL] })
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Innercoop.CorePort.Test.Optional'));
  });

  it('расширение без заявки проверку проходит — заявка необязательна', async () => {
    const { service, moduleRef } = createService([]);

    await expect(assertPorts(service, undefined)).resolves.toBeUndefined();
    expect(moduleRef.get).not.toHaveBeenCalled();
  });
});

describe('Заявки расширений в реестре', () => {
  it('у каждого расширения, которое просит порты, заявка непустая', () => {
    const withPorts = Object.entries(AppRegistry).filter(([, extension]) => extension.ports);

    expect(withPorts.length).toBeGreaterThan(0);
    for (const [name, extension] of withPorts) {
      expect({ name, required: extension.ports!.required.length }).toEqual({
        name,
        required: expect.any(Number),
      });
      expect(extension.ports!.required.every((token) => typeof token === 'symbol')).toBe(true);
      expect(extension.ports!.optional.every((token) => typeof token === 'symbol')).toBe(true);
    }
  });
});
