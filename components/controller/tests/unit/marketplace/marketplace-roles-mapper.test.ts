/**
 * Unit-тесты mapCoreRolesToMarketplaceRoles (Story 1.6).
 *
 * Покрывают matrix-кейсы AC: все 4 варианта core_roles × все варианты
 * context-флагов (isOfferer/isKuChairman).
 */
import { mapCoreRolesToMarketplaceRoles } from '~/extensions/marketplace/application/membership/marketplace-roles.mapper';

describe('mapCoreRolesToMarketplaceRoles', () => {
  it('обычный пайщик [User] → [orderer]', () => {
    expect(mapCoreRolesToMarketplaceRoles(['User'])).toEqual(['orderer']);
  });

  it('[User] + isOfferer → [orderer, offerer]', () => {
    expect(mapCoreRolesToMarketplaceRoles(['User'], { isOfferer: true })).toEqual([
      'orderer',
      'offerer',
    ]);
  });

  it('[User] + isKuChairman → [orderer, operator]', () => {
    expect(mapCoreRolesToMarketplaceRoles(['User'], { isKuChairman: true })).toEqual([
      'orderer',
      'operator',
    ]);
  });

  it('[User, Member] → [orderer, board_readonly]', () => {
    expect(mapCoreRolesToMarketplaceRoles(['User', 'Member'])).toEqual([
      'orderer',
      'board_readonly',
    ]);
  });

  it('[User, Member, Chairman] → [orderer, board_readonly, admin, board]', () => {
    expect(mapCoreRolesToMarketplaceRoles(['User', 'Member', 'Chairman'])).toEqual([
      'orderer',
      'board_readonly',
      'admin',
      'board',
    ]);
  });

  it('[User, Member, Chairman] + оба флага → полный набор', () => {
    expect(
      mapCoreRolesToMarketplaceRoles(['User', 'Member', 'Chairman'], {
        isOfferer: true,
        isKuChairman: true,
      })
    ).toEqual(['orderer', 'offerer', 'operator', 'board_readonly', 'admin', 'board']);
  });

  it('Без User в core_roles (admin платформы) → []', () => {
    expect(mapCoreRolesToMarketplaceRoles([])).toEqual([]);
    expect(mapCoreRolesToMarketplaceRoles([], { isOfferer: true })).toEqual([]);
  });
});
