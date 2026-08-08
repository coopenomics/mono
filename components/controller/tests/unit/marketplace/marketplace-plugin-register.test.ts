/**
 * Unit-тесты registerMarketplaceInAgreementRegistry.
 *
 * Покрывают (после фикса персонализации оферты):
 *   (a) оферта регистрируется на ПЕРСОНАЛЬНЫЙ инстанс
 *       MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID (1102.MarketplaceOffer), НЕ на
 *       шаблоне 1101.MarketplaceOfferTemplate; applicable_account_types пустой
 *       (подтягивается только через программу); функция возвращает true.
 *   (b) если instance_registry_id занулить (ЦПП не активирована) → port не
 *       вызывается, функция возвращает false.
 *   (c) константы согласованы с on-chain именами (eosio::name regex).
 *   (d) ЦПП «Стол заказов» регистрируется как ВЫБИРАЕМАЯ программа
 *       (registerProgram × 1) с agreement_ids = [оферта] и key = program_key.
 */

import {
  MARKETPLACE_AGREEMENT_TYPE,
  MARKETPLACE_EXTENSION_NAME,
  MARKETPLACE_OFFER_AGREEMENT_ID,
  MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID,
  MARKETPLACE_PROGRAM_KEY,
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
  it('оферта регистрируется на персональный инстанс (1102), applicable_account_types пуст, true', () => {
    const port = makePortStub();

    const ok = registerMarketplaceInAgreementRegistry(port as any);

    expect(MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID).toBe(1102);
    expect(ok).toBe(true);
    expect(port.registerAgreement).toHaveBeenCalledTimes(1);
    const spec = port.registerAgreement.mock.calls[0][0];
    expect(spec.id).toBe(MARKETPLACE_OFFER_AGREEMENT_ID);
    // Ключевое: инстанс, НЕ шаблон.
    expect(spec.registry_id).toBe(MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID);
    expect(spec.agreement_type).toBe(MARKETPLACE_AGREEMENT_TYPE);
    expect(spec.extension_name).toBe(MARKETPLACE_EXTENSION_NAME);
    // Подтягивается только через выбор программы, не как дефолтная.
    expect(spec.applicable_account_types).toEqual([]);
  });

  it('ЦПП не активирована (instance_registry_id = 0) → port не вызывается, false', () => {
    jest.resetModules();
    jest.doMock('~/extensions/marketplace/constants/marketplace-agreement-ids', () => ({
      __esModule: true,
      MARKETPLACE_EXTENSION_NAME: 'market',
      MARKETPLACE_OFFER_AGREEMENT_ID: 'marketplace_offer',
      MARKETPLACE_AGREEMENT_TYPE: 'marketplace',
      MARKETPLACE_PROGRAM_KEY: 'MARKETPLACE',
      MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID: 0,
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { registerMarketplaceInAgreementRegistry: reg } = require('~/extensions/marketplace/application/registration/register-marketplace-in-agreement-registry');
    const port = makePortStub();
    const ok = reg(port as any);
    expect(ok).toBe(false);
    expect(port.registerAgreement).not.toHaveBeenCalled();
    expect(port.registerProgram).not.toHaveBeenCalled();
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
  });

  it('константы используют согласованные имена для on-chain и реестра', () => {
    expect(MARKETPLACE_EXTENSION_NAME).toBe('market');
    expect(MARKETPLACE_OFFER_AGREEMENT_ID).toBe('marketplace_offer');
    // eosio::name: max 12 chars, без `_`; совпадает с _marketplace_program в lib/consts.hpp.
    expect(MARKETPLACE_AGREEMENT_TYPE).toBe('marketplace');
    expect(MARKETPLACE_AGREEMENT_TYPE).toMatch(/^[.a-z1-5]{1,12}$/);
  });

  it('ЦПП «Стол заказов» регистрируется как выбираемая программа (registerProgram × 1)', () => {
    const port = makePortStub();
    registerMarketplaceInAgreementRegistry(port as any);
    expect(port.registerProgram).toHaveBeenCalledTimes(1);
    const prog = port.registerProgram.mock.calls[0][0];
    expect(prog.key).toBe(MARKETPLACE_PROGRAM_KEY);
    expect(prog.agreement_ids).toEqual([MARKETPLACE_OFFER_AGREEMENT_ID]);
    expect(prog.extension_name).toBe(MARKETPLACE_EXTENSION_NAME);
  });
});
