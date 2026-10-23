/**
 * Приёмка: чужой участок и чужой акт закрыты отказом по охвату (#208, C28-87).
 *
 * Зеркало #205/#206/#207 на стороне приёмки. Сверку ведёт общий гард по
 * источнику, который называет операция:
 *   - лента приёмок участка (operator, `Receiving:create`) → участок из запроса;
 *   - документы к подписи поставщика (offerer, `sign:first`) → поставщик акта;
 *   - документы к закрывающей подписи (operator, `sign:closing`) → участок акта.
 * В каждом блоке: владелец или оператор участка проходит, чужой получает
 * отказ до входа в операцию.
 */
import { memberOf, makeScopeGuard, requirementOf, type ScopeWorld } from './right-scope.harness';

const RESOLVER = 'marketplace-apl-reception.resolver.ts';

const world: ScopeWorld = {
  branches: { krg: { trustee: 'chairkrg', trusted: ['trustkrg'] }, msk: { trustee: 'chairmsk' } },
  objects: { Reception: { r1: { offerer_account: 'sup1', braname: 'krg' } } },
};

const chairKrg = memberOf('chairkrg', 'orderer', 'operator');
const chairMsk = memberOf('chairmsk', 'orderer', 'operator');
const supplier = memberOf('sup1', 'orderer', 'offerer');
const otherSupplier = memberOf('sup2', 'orderer', 'offerer');

describe('marketplaceListAplReceptionsByBraname: участок из запроса', () => {
  const requirement = () => requirementOf(RESOLVER, 'marketplaceListAplReceptionsByBraname');

  it('оператор запрошенного участка → лента отдаётся', async () => {
    const { granted, kuChairmanService } = makeScopeGuard(world);
    await expect(granted(requirement(), chairKrg, { data: { braname: 'krg' } })).resolves.toMatchObject({
      scopes: ['own-KU'],
    });
    expect(kuChairmanService.listBranamesForMember).toHaveBeenCalledWith(expect.any(String), 'chairkrg');
  });

  it('оператор другого участка → отказ по охвату', async () => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirement(), chairMsk, { data: { braname: 'krg' } })).rejects.toMatchObject({
      code: 'KIT_RIGHT_SCOPE_OWN_KU',
    });
  });
});

describe('marketplaceAplReceptionSupplierSignablePayloads: поставщик акта', () => {
  const requirement = () => requirementOf(RESOLVER, 'marketplaceAplReceptionSupplierSignablePayloads');

  it('поставщик своей приёмки → документы отдаются', async () => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirement(), supplier, { data: { apl_reception_id: 'r1' } })).resolves.toMatchObject({
      scopes: ['own'],
    });
  });

  it('другой поставщик → отказ по охвату', async () => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirement(), otherSupplier, { data: { apl_reception_id: 'r1' } })).rejects.toMatchObject({
      code: 'KIT_RIGHT_SCOPE_OWN',
    });
  });
});

describe('marketplaceAplReceptionChairmanSignablePayloads: участок акта', () => {
  const requirement = () => requirementOf(RESOLVER, 'marketplaceAplReceptionChairmanSignablePayloads');

  it('оператор участка приёмки → документы отдаются', async () => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirement(), chairKrg, { data: { apl_reception_id: 'r1' } })).resolves.toMatchObject({
      scopes: ['own-KU'],
    });
  });

  it('оператор другого участка → отказ по охвату', async () => {
    const { granted } = makeScopeGuard(world);
    await expect(granted(requirement(), chairMsk, { data: { apl_reception_id: 'r1' } })).rejects.toMatchObject({
      code: 'KIT_RIGHT_SCOPE_OWN_KU',
    });
  });
});
