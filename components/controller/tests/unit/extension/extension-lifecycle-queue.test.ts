/**
 * Запуск, остановка и перезапуск одного расширения идут по очереди.
 *
 * `updateExtension` перезапускает расширение, не дожидаясь конца запуска, а
 * запуск длится секунды. Раньше выключение, пришедшее во время запуска, не
 * находило расширение среди работающих и ничего не останавливало; запуск
 * завершался, и выключенное приложение продолжало работать со своими
 * шаблонами и программами (blackbox 31.10.2026).
 */
import { EXTENSION_APP_TERMINATE_EVENT } from '@coopenomics/extension-kit';
import { ExtensionLifecycleDomainService } from '~/domain/extension/services/extension-lifecycle-domain.service';
import { AppRegistry } from '~/extensions/extensions.registry';

const NAME = 'lifecycle-queue-test';

class SlowModule {
  initialize = jest.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function createService(enabled: () => boolean) {
  const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(), setContext: jest.fn() };
  const emitter = { emit: jest.fn() };
  const module = new SlowModule();
  const extensions = { getAppByName: jest.fn(async () => ({ name: NAME, enabled: enabled(), config: {} })) };
  const moduleRef = { get: jest.fn(() => module), resolve: jest.fn() };

  const service = new ExtensionLifecycleDomainService(
    extensions as any,
    {} as any,
    logger as any,
    emitter as any,
    moduleRef as any
  );
  return { service, emitter, module };
}

const isActive = (service: ExtensionLifecycleDomainService) => Boolean((service as any).activeAppMap[NAME]);

describe('Жизненный цикл расширения — операции по очереди', () => {
  beforeAll(() => {
    (AppRegistry as any)[NAME] = { class: SlowModule };
  });

  afterAll(() => {
    delete (AppRegistry as any)[NAME];
  });

  it('выключение во время запуска дожидается его и останавливает расширение', async () => {
    let enabled = true;
    const { service, emitter, module } = createService(() => enabled);
    let stopping: Promise<void> | undefined;
    // Выключение приходит, когда запуск уже прочитал «включено» и идёт initialize.
    module.initialize.mockImplementationOnce(async () => {
      enabled = false;
      stopping = service.terminateApp(NAME);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await service.runApp(NAME);
    await stopping;

    expect(isActive(service)).toBe(false);
    expect(emitter.emit).toHaveBeenCalledWith(EXTENSION_APP_TERMINATE_EVENT, { appName: NAME });
  });

  it('выключение после перезапуска, который ещё идёт, оставляет расширение остановленным', async () => {
    let enabled = true;
    const { service, module } = createService(() => enabled);
    await service.runApp(NAME);
    // Выключение приходит, когда перезапуск уже прочитал «включено» и ждёт initialize.
    module.initialize.mockImplementationOnce(async () => {
      enabled = false;
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const restarting = service.restartApp(NAME);
    const stopping = new Promise<void>((resolve) => setTimeout(() => resolve(service.terminateApp(NAME)), 5));
    await Promise.all([restarting, stopping]);

    expect(module.initialize).toHaveBeenCalledTimes(2);
    expect(isActive(service)).toBe(false);
  });

  it('отказ запуска не держит очередь: следующая операция выполняется', async () => {
    const { service, module } = createService(() => true);
    module.initialize.mockRejectedValueOnce(new Error('сбой запуска'));

    await expect(service.runApp(NAME)).rejects.toThrow('сбой запуска');
    await service.runApp(NAME);

    expect(isActive(service)).toBe(true);
  });
});
