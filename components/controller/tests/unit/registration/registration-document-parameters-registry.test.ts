import { RegistrationDocumentParametersRegistry } from '../../../src/domain/registration/services/registration-document-parameters.registry';
import type {
  IMarketplaceDocumentParametersHook,
  IProgramDocumentParametersHook,
} from '@coopenomics/innercoop';

/**
 * Реестр хуков параметров оферт.
 *
 * Проверяется то, ради чего он заведён: расширение кладёт свою реализацию само,
 * а поток вступления переживает её отсутствие. Раньше хук инжектился по токену,
 * и видимость держалась на импорте модуля расширений ядром — том самом ребре,
 * которое замыкало цикл.
 */
describe('RegistrationDocumentParametersRegistry', () => {
  const programHook = (): IProgramDocumentParametersHook => ({
    generateBlagorostOfferParameters: jest.fn(async () => undefined),
    generateGeneratorOfferParameters: jest.fn(async () => undefined),
    generateGenerationContractParameters: jest.fn(async () => undefined),
    generateStorageAgreementParameters: jest.fn(async () => undefined),
    generateBlagorostAgreementParametersIfNotExist: jest.fn(async () => undefined),
  });

  const marketplaceHook = (): IMarketplaceDocumentParametersHook => ({
    generateMarketplaceOfferParameters: jest.fn(async () => undefined),
  });

  it('пустой реестр отдаёт undefined: расширения может не быть в кооперативе', () => {
    const registry = new RegistrationDocumentParametersRegistry();

    expect(registry.programParameters()).toBeUndefined();
    expect(registry.marketplaceParameters()).toBeUndefined();
  });

  it('отдаёт ровно ту реализацию, которую положило расширение', () => {
    const registry = new RegistrationDocumentParametersRegistry();
    const program = programHook();
    const marketplace = marketplaceHook();

    registry.registerProgramHook(program);
    registry.registerMarketplaceHook(marketplace);

    expect(registry.programParameters()).toBe(program);
    expect(registry.marketplaceParameters()).toBe(marketplace);
  });

  it('слоты независимы: Стол заказов ставится в кооператив без Благороста', () => {
    const registry = new RegistrationDocumentParametersRegistry();
    const marketplace = marketplaceHook();

    registry.registerMarketplaceHook(marketplace);

    expect(registry.marketplaceParameters()).toBe(marketplace);
    expect(registry.programParameters()).toBeUndefined();
  });

  it('повторная регистрация заменяет реализацию — перезапуск расширения не двоит слот', () => {
    const registry = new RegistrationDocumentParametersRegistry();
    const first = programHook();
    const second = programHook();

    registry.registerProgramHook(first);
    registry.registerProgramHook(second);

    expect(registry.programParameters()).toBe(second);
  });
});
