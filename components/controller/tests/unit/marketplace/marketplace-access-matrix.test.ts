/**
 * Unit-тесты централизованной marketplace-access-matrix (Story 1.8).
 *
 * Покрывают AC:
 *   - canAccess(roles, resource, action) учитывает ЛЮБУЮ из ролей;
 *   - exact-match по action (`read:own` != `read`);
 *   - roleHasAnyAction матчит базовый action и все его :квалификаторы;
 *   - матрица содержит ожидаемые ключи для всех 6 marketplace-ролей.
 */
import {
  canAccess,
  marketplaceAccessMatrix,
  roleHasAnyAction,
} from '~/extensions/marketplace/application/access/marketplace-access-matrix';

describe('marketplaceAccessMatrix', () => {
  it('содержит все 6 marketplace-ролей', () => {
    const roles = Object.keys(marketplaceAccessMatrix).sort();
    expect(roles).toEqual([
      'admin',
      'board',
      'board_readonly',
      'offerer',
      'operator',
      'orderer',
    ]);
  });

  it('orderer имеет Order:create, Order:read:own, Order:cancel:own, Offer:read', () => {
    expect(marketplaceAccessMatrix.orderer.Order).toContain('create');
    expect(marketplaceAccessMatrix.orderer.Order).toContain('read:own');
    expect(marketplaceAccessMatrix.orderer.Order).toContain('cancel:own');
    expect(marketplaceAccessMatrix.orderer.Offer).toContain('read');
  });

  it('admin имеет KU:manage и Vitrine:manage', () => {
    expect(marketplaceAccessMatrix.admin.KU).toContain('manage');
    expect(marketplaceAccessMatrix.admin.Vitrine).toContain('manage');
  });
});

describe('canAccess', () => {
  it('orderer может Order:create', () => {
    expect(canAccess(['orderer'], 'Order', 'create')).toBe(true);
  });

  it('orderer не может Order:read:all (нотация exact-match)', () => {
    expect(canAccess(['orderer'], 'Order', 'read:all')).toBe(false);
  });

  it('OR по ролям: пайщик [orderer, board_readonly] может Order:read:all (от board_readonly)', () => {
    expect(canAccess(['orderer', 'board_readonly'], 'Order', 'read:all')).toBe(true);
  });

  it('admin может KU:manage, но не KU:read:own-KU (нет KU:read:all → иерархия не применяется)', () => {
    expect(canAccess(['admin'], 'KU', 'manage')).toBe(true);
    expect(canAccess(['admin'], 'KU', 'read:own-KU')).toBe(false);
  });

  it('иерархия охвата: admin с Warehouse:read:all проходит гейт Warehouse:read:own-KU', () => {
    // admin имеет Warehouse:['read:all']; резолвер склада декларирует read:own-KU.
    expect(canAccess(['admin'], 'Warehouse', 'read:own-KU')).toBe(true);
    expect(canAccess(['board_readonly'], 'Warehouse', 'read:own-KU')).toBe(true);
  });

  it('иерархия охвата: Order:read:all удовлетворяет Order:read:own / read:to-self', () => {
    expect(canAccess(['admin'], 'Order', 'read:own')).toBe(true);
    expect(canAccess(['board_readonly'], 'Order', 'read:to-self')).toBe(true);
  });

  it('иерархия НЕ работает в обратную сторону: orderer с read:own не получает read:all', () => {
    expect(canAccess(['orderer'], 'Order', 'read:all')).toBe(false);
  });

  it('operator с read:own-KU НЕ проходит гейт read:all (нет :all → не суперсет)', () => {
    expect(canAccess(['operator'], 'Warehouse', 'read:all')).toBe(false);
  });

  it('roles=[] → false для любого resource:action', () => {
    expect(canAccess([], 'Order', 'create')).toBe(false);
  });

  it('unknown resource или action → false', () => {
    expect(canAccess(['orderer'], 'NotAResource', 'create')).toBe(false);
    expect(canAccess(['orderer'], 'Order', 'evil-action')).toBe(false);
  });
});

describe('roleHasAnyAction', () => {
  it('orderer имеет ANY read на Order (есть read:own)', () => {
    expect(roleHasAnyAction(['orderer'], 'Order', 'read')).toBe(true);
  });

  it('orderer не имеет ANY moderate на Offer', () => {
    expect(roleHasAnyAction(['orderer'], 'Offer', 'moderate')).toBe(false);
  });

  it('admin имеет ANY moderate на Offer (есть buy moderate)', () => {
    expect(roleHasAnyAction(['admin'], 'Offer', 'moderate')).toBe(true);
  });
});
