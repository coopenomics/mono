import { ExtensionAvailability, isExtensionAvailable } from '@coopenomics/extension-kit';
import { AppRegistry } from '~/extensions/extensions.registry';

describe('Доступность расширений по сети', () => {
  describe('isExtensionAvailable', () => {
    it('EVERYWHERE открыто и в основной сети, и вне её', () => {
      expect(isExtensionAvailable(ExtensionAvailability.EVERYWHERE, true)).toBe(true);
      expect(isExtensionAvailable(ExtensionAvailability.EVERYWHERE, false)).toBe(true);
    });

    it('NON_MAINNET_ONLY закрыто в основной сети и открыто на тестовом контуре', () => {
      expect(isExtensionAvailable(ExtensionAvailability.NON_MAINNET_ONLY, true)).toBe(false);
      expect(isExtensionAvailable(ExtensionAvailability.NON_MAINNET_ONLY, false)).toBe(true);
    });

    it('NOWHERE закрыто в любой сети', () => {
      expect(isExtensionAvailable(ExtensionAvailability.NOWHERE, true)).toBe(false);
      expect(isExtensionAvailable(ExtensionAvailability.NOWHERE, false)).toBe(false);
    });

    it('DEVELOPMENT_ONLY открыто только в контуре разработки, в любой сети', () => {
      expect(isExtensionAvailable(ExtensionAvailability.DEVELOPMENT_ONLY, false, true)).toBe(true);
      expect(isExtensionAvailable(ExtensionAvailability.DEVELOPMENT_ONLY, true, true)).toBe(true);
      expect(isExtensionAvailable(ExtensionAvailability.DEVELOPMENT_ONLY, false, false)).toBe(false);
      expect(isExtensionAvailable(ExtensionAvailability.DEVELOPMENT_ONLY, true, false)).toBe(false);
    });

    it('без признака разработки DEVELOPMENT_ONLY закрыто — по умолчанию узел считается выпускным', () => {
      expect(isExtensionAvailable(ExtensionAvailability.DEVELOPMENT_ONLY, false)).toBe(false);
    });
  });

  describe('AppRegistry', () => {
    it('у каждой записи реестра указана доступность', () => {
      for (const [name, ext] of Object.entries(AppRegistry)) {
        expect(Object.values(ExtensionAvailability)).toContain(ext.availability);
        expect(typeof name).toBe('string');
      }
    });

    it('Карта кооператора открыта везде, включая основную сеть (решение владельца 08.09.2026)', () => {
      expect(AppRegistry.cardcoop.availability).toBe(ExtensionAvailability.EVERYWHERE);
      expect(isExtensionAvailable(AppRegistry.cardcoop.availability, true)).toBe(true);
      expect(isExtensionAvailable(AppRegistry.cardcoop.availability, false)).toBe(true);
    });

    it('Образовательный мост открыт везде, включая основную сеть (решение владельца 15.10.2026)', () => {
      expect(AppRegistry.edubridge.availability).toBe(ExtensionAvailability.EVERYWHERE);
      expect(isExtensionAvailable(AppRegistry.edubridge.availability, true)).toBe(true);
      expect(isExtensionAvailable(AppRegistry.edubridge.availability, false)).toBe(true);
    });

    it('Стол заказов открыт только вне основной сети', () => {
      expect(AppRegistry.market.availability).toBe(ExtensionAvailability.NON_MAINNET_ONLY);
      expect(isExtensionAvailable(AppRegistry.market.availability, true)).toBe(false);
      expect(isExtensionAvailable(AppRegistry.market.availability, false)).toBe(true);
    });

    it('Стол разработчика открыт только в контуре разработки и не ставится сам (решение владельца 23.10.2026)', () => {
      expect(AppRegistry.developer.availability).toBe(ExtensionAvailability.DEVELOPMENT_ONLY);
      expect(AppRegistry.developer.defaults).toBeUndefined();
      expect(isExtensionAvailable(AppRegistry.developer.availability, false, false)).toBe(false);
      expect(isExtensionAvailable(AppRegistry.developer.availability, true, false)).toBe(false);
    });

    // 20.10.2026: DaData приезжала в каждый кооператив установленной и выключенной.
    it('DaData не ставится по умолчанию — её ставит председатель из каталога с ключом', () => {
      expect(AppRegistry.dadata.defaults).toBeUndefined();
    });
  });
});
