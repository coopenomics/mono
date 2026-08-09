/**
 * Unit-тесты MarketplaceRegistrationOfferResolver (Story 1.10).
 *
 * Покрывают AC:
 *   (a) AgreementQueryPort вернул null → registered=false;
 *   (b) AgreementQueryPort вернул IAgreementConfigItem → registered=true
 *       + agreement_id, registry_id, agreement_type, title, applicable_account_types.
 */
import { MarketplaceRegistrationOfferResolver } from '~/extensions/marketplace/application/resolvers/marketplace-registration-offer.resolver';

const makePort = (item: any) =>
  ({
    getAgreementById: jest.fn().mockReturnValue(item),
    getAgreementsForAccountType: jest.fn(),
    getAgreementsForProgram: jest.fn(),
    getAvailablePrograms: jest.fn(),
  } as any);

describe('MarketplaceRegistrationOfferResolver', () => {
  it('AgreementQueryPort.getAgreementById null → registered=false', async () => {
    const resolver = new MarketplaceRegistrationOfferResolver(makePort(null));
    const dto = await resolver.marketplaceRegistrationOfferStatus();
    expect(dto.registered).toBe(false);
    expect(dto.agreement_id).toBeUndefined();
    expect(dto.registry_id).toBeUndefined();
  });

  it('AgreementQueryPort вернул item → registered=true с заполненными полями', async () => {
    const item = {
      id: 'marketplace_offer',
      registry_id: 1100,
      agreement_type: 'marketplace',
      title: 'Оферта Стола заказов',
      checkbox_text: 'Я принимаю',
      link_text: 'оферту',
      is_blockchain_agreement: true,
      link_to_statement: false,
      applicable_account_types: ['individual', 'entrepreneur'],
      order: 7,
    };
    const resolver = new MarketplaceRegistrationOfferResolver(makePort(item));
    const dto = await resolver.marketplaceRegistrationOfferStatus();

    expect(dto.registered).toBe(true);
    expect(dto.agreement_id).toBe('marketplace_offer');
    expect(dto.registry_id).toBe(1100);
    expect(dto.agreement_type).toBe('marketplace');
    expect(dto.title).toBe('Оферта Стола заказов');
    expect(dto.applicable_account_types).toEqual(['individual', 'entrepreneur']);
  });
});
