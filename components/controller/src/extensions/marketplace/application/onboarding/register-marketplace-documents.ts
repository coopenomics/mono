import type { IDocumentDeclarationPort, InnerDocumentDeclaration } from '@coopenomics/innercoop';
import { Registry } from '@coopenomics/docs-templates';
import { MARKETPLACE_EXTENSION_NAME } from '../../constants/marketplace-agreement-ids';

const R = Registry;

const doc = (
  registry_id: number,
  kind: InnerDocumentDeclaration['kind'],
  order: number,
  extra: Partial<Pick<InnerDocumentDeclaration, 'bundle' | 'vars_field'>> = {}
): InnerDocumentDeclaration => ({
  extension_name: MARKETPLACE_EXTENSION_NAME,
  registry_id,
  kind,
  approval: kind === 'service' ? 'none' : 'required',
  order,
  ...extra,
});

/**
 * Документы Стола заказов в реестре шаблонов кооператива.
 *
 * Положение и оферта наследуют ключи шагов онбординга (`marketplace_provision`,
 * `marketplace_offer_template`). Шаблон-двойник оферты 1101 не объявляется:
 * совет утверждает рабочую оферту 1102 в бланке, поле `vars` сохраняет имя
 * `marketplace_offer_template`, которое подставляет текст оферты.
 */
export async function registerMarketplaceDocuments(port: IDocumentDeclarationPort): Promise<void> {
  await port.unregisterByExtension(MARKETPLACE_EXTENSION_NAME);
  await port.registerDocuments([
    doc(R.MarketplaceProgramTemplate.registry_id, 'provision', 10, { bundle: 'marketplace_provision', vars_field: 'marketplace_provision' }),
    doc(R.MarketplaceOffer.registry_id, 'agreement', 20, { bundle: 'marketplace_offer_template', vars_field: 'marketplace_offer_template' }),

    doc(R.MarketplaceTransportNote.registry_id, 'form', 30, { bundle: 'marketplace_forms' }),
    doc(R.MarketplaceAplReception.registry_id, 'form', 31, { bundle: 'marketplace_forms' }),
    doc(R.MarketplaceReturnStatement.registry_id, 'form', 33, { bundle: 'marketplace_forms' }),
    doc(R.MarketplaceWriteoffStatement.registry_id, 'form', 34, { bundle: 'marketplace_forms' }),
    doc(R.MarketplaceConvertStatement.registry_id, 'form', 35, { bundle: 'marketplace_forms' }),
    doc(R.MarketplaceWriteoffServiceMemo.registry_id, 'form', 36, { bundle: 'marketplace_forms' }),
    doc(R.MarketplaceShareReturnStatement.registry_id, 'form', 37, { bundle: 'marketplace_forms' }),
    doc(R.MarketplaceShareReturnAct.registry_id, 'form', 38, { bundle: 'marketplace_forms' }),
    doc(R.MarketplaceReturnCancelStatement.registry_id, 'form', 39, { bundle: 'marketplace_forms' }),

    // Инвестиционный этап кооперативного участка (задача 99D-29): договор
    // участия утверждает совет как соглашение, заявления и акт — бланки.
    // Реквизиты протокола пакета пишутся в vars.marketplace_invest_agreement_template:
    // шапка договора «Утвержден Собранием Совета, Протокол № … от …» (99D-35).
    doc(R.MarketplaceInvestAgreement.registry_id, 'agreement', 21, { bundle: 'marketplace_invest', vars_field: 'marketplace_invest_agreement_template' }),
    doc(R.MarketplaceInvestStatement.registry_id, 'form', 40, { bundle: 'marketplace_invest' }),
    doc(R.MarketplaceInvestPropertyStatement.registry_id, 'form', 41, { bundle: 'marketplace_invest' }),
    doc(R.MarketplaceInvestPropertyAct.registry_id, 'form', 42, { bundle: 'marketplace_invest' }),
    doc(R.MarketplaceInvestClaimStatement.registry_id, 'form', 43, { bundle: 'marketplace_invest' }),

    doc(R.MarketplaceWriteoffProtocol.registry_id, 'service', 90),
    doc(R.MarketplaceShareReturnDecision.registry_id, 'service', 91),
    doc(R.MarketplaceReturnCancelDecision.registry_id, 'service', 92),
    doc(R.MarketplaceInvestPropertyDecision.registry_id, 'service', 93),
  ]);
}
