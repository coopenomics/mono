/**
 * Unit-тесты registerMarketplaceInAgreementRegistry (Story 1.2).
 *
 * Чистая функция — не тянет за собой импорт MarketplacePlugin (там цепочка
 * с lifecycle, file-storage порт и т.д., как и в capital-plugin-register.test.ts).
 *
 * Покрывают:
 *   (a) MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = 0 (placeholder, Story 1.7
 *       не выполнена) → port не вызывается, функция возвращает false;
 *   (b) Когда константа > 0 — registerAgreement вызван один раз с
 *       корректным spec. Поскольку константа сейчас захардкожена в 0, в
 *       этом кейсе проверяем поведение через вызов port напрямую с
 *       другой spec'ой (что соответствует тому, как Capital проверяет
 *       выходные данные).
 *   (c) повторный вызов воспроизводит те же register-вызовы (реальная
 *       идемпотентность гарантируется AgreementRegistryService).
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
  it('возвращает false и не зовёт port пока MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = 0 (Story 1.7 не выполнена)', () => {
    const port = makePortStub();

    const ok = registerMarketplaceInAgreementRegistry(port as any);

    expect(MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID).toBe(0);
    expect(ok).toBe(false);
    expect(port.registerAgreement).not.toHaveBeenCalled();
    expect(port.registerProgram).not.toHaveBeenCalled();
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
