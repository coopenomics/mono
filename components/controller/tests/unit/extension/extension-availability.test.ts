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
  });

  describe('AppRegistry', () => {
    it('у каждой записи реестра указана доступность', () => {
      for (const [name, ext] of Object.entries(AppRegistry)) {
        expect(Object.values(ExtensionAvailability)).toContain(ext.availability);
        expect(typeof name).toBe('string');
      }
    });

    it('Карта кооператора открыта только вне основной сети — сеть карт обкатывается на тестовом контуре', () => {
      expect(AppRegistry.cardcoop.availability).toBe(ExtensionAvailability.NON_MAINNET_ONLY);
      expect(isExtensionAvailable(AppRegistry.cardcoop.availability, true)).toBe(false);
      expect(isExtensionAvailable(AppRegistry.cardcoop.availability, false)).toBe(true);
    });

    it('Стол заказов открыт только вне основной сети', () => {
      expect(AppRegistry.market.availability).toBe(ExtensionAvailability.NON_MAINNET_ONLY);
      expect(isExtensionAvailable(AppRegistry.market.availability, true)).toBe(false);
      expect(isExtensionAvailable(AppRegistry.market.availability, false)).toBe(true);
    });
  });
});
