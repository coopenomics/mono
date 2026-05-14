/**
 * Unit-тесты registerMarketplaceInAgreementRegistry (Story 1.2 + Story 1.7).
 *
 * Покрывают:
 *   (a) реальный template_registry_id из cooptypes (Story 1.7 выполнена,
 *       MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = 1100) → port.registerAgreement
 *       вызывается × 1, функция возвращает true.
 *   (b) если константу принудительно занулить (placeholder режим до Story 1.7) →
 *       port не вызывается, функция возвращает false. Это историческое
 *       поведение, тест зафиксирован для гарантии будущей деградации (например,
 *       при rollback Story 1.7).
 *   (c) константы согласованы с on-chain именами (eosio::name regex).
 *   (d) programs для marketplace MVP не регистрируются.
 */

import {
  MARKETPLACE_AGREEMENT_TYPE,
  MARKETPLACE_EXTENSION_NAME,
  MARKETPLACE_OFFER_AGREEMENT_ID,
  MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID,
} from '~/extensions/marketplace/constants/marketplace-agreement-ids';
import { registerMarketplaceInAgreementRegistry } from '~/extensions/marketplace/application/registration/register-marketplace-in-agreement-registry';

function makePortStub() {
  return {
    registerAgreement: jest.fn(),
    unregisterAgreement: jest.fn(),
    registerProgram: jest.fn(),
    unregisterProgram: jest.fn(),
  };
}

describe('registerMarketplaceInAgreementRegistry', () => {
  it('Story 1.7 размещён template — registry_id из cooptypes (1100), port.registerAgreement × 1', () => {
    const port = makePortStub();

    const ok = registerMarketplaceInAgreementRegistry(port as any);

    expect(MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID).toBe(1100);
    expect(ok).toBe(true);
    expect(port.registerAgreement).toHaveBeenCalledTimes(1);
    const spec = port.registerAgreement.mock.calls[0][0];
    expect(spec.id).toBe(MARKETPLACE_OFFER_AGREEMENT_ID);
    expect(spec.registry_id).toBe(MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID);
    expect(spec.agreement_type).toBe(MARKETPLACE_AGREEMENT_TYPE);
    expect(spec.extension_name).toBe(MARKETPLACE_EXTENSION_NAME);
  });

  it('rollback Story 1.7 (template_registry_id = 0) → port не вызывается, false', () => {
    jest.resetModules();
    jest.doMock('~/extensions/marketplace/constants/marketplace-agreement-ids', () => ({
      __esModule: true,
      MARKETPLACE_EXTENSION_NAME: 'market',
      MARKETPLACE_OFFER_AGREEMENT_ID: 'marketplace_offer',
      MARKETPLACE_AGREEMENT_TYPE: 'marketplace',
      MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID: 0,
    }));
    const { registerMarketplaceInAgreementRegistry: reg } = require('~/extensions/marketplace/application/registration/register-marketplace-in-agreement-registry');
    const port = makePortStub();
    const ok = reg(port as any);
    expect(ok).toBe(false);
    expect(port.registerAgreement).not.toHaveBeenCalled();
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
  });

  it('константы используют согласованные имена для on-chain и реестра', () => {
    expect(MARKETPLACE_EXTENSION_NAME).toBe('market');
    expect(MARKETPLACE_OFFER_AGREEMENT_ID).toBe('marketplace_offer');
    // eosio::name: max 12 chars, без `_`; совпадает с _marketplace_program в lib/consts.hpp.
    expect(MARKETPLACE_AGREEMENT_TYPE).toBe('marketplace');
    expect(MARKETPLACE_AGREEMENT_TYPE).toMatch(/^[.a-z1-5]{1,12}$/);
  });

  it('программы для marketplace MVP не регистрируются (Стол заказов — ЦПП без program-надстройки)', () => {
    const port = makePortStub();
    registerMarketplaceInAgreementRegistry(port as any);
    expect(port.registerProgram).not.toHaveBeenCalled();
  });
});
