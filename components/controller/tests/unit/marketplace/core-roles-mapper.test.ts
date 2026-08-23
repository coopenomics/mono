/**
 * Unit-тесты mapUserRoleToCoreRoles (Story 1.3).
 *
 * Маппинг user.role (один из 'user'/'member'/'chairman'/'admin') в
 * core_roles[] (['User']/['User','Member']/['User','Member','Chairman']/[]) —
 * иерархический. Покрываем все 4 варианта AC + missing/неизвестное.
 */
import { mapUserRoleToCoreRoles } from '~/extensions/marketplace/application/membership/core-roles.mapper';

describe('mapUserRoleToCoreRoles', () => {
  it('обычный пайщик (user) → [User]', () => {
    expect(mapUserRoleToCoreRoles('user')).toEqual(['User']);
  });

  it('член совета (member) → [User, Member]', () => {
    expect(mapUserRoleToCoreRoles('member')).toEqual(['User', 'Member']);
  });

  it('председатель (chairman) → [User, Member, Chairman]', () => {
    expect(mapUserRoleToCoreRoles('chairman')).toEqual(['User', 'Member', 'Chairman']);
  });

  it('admin или неизвестная роль → []', () => {
    expect(mapUserRoleToCoreRoles('admin')).toEqual([]);
    expect(mapUserRoleToCoreRoles('unknown')).toEqual([]);
  });

  it('пустая/missing роль → []', () => {
    expect(mapUserRoleToCoreRoles(undefined)).toEqual([]);
    expect(mapUserRoleToCoreRoles(null)).toEqual([]);
    expect(mapUserRoleToCoreRoles('')).toEqual([]);
  });
});
