import type { IDocumentDeclarationPort, InnerDocumentDeclaration } from '@coopenomics/innercoop';
import { Cooperative } from 'cooptypes';

const R = Cooperative.Registry;
const EXTENSION = 'capital';

const doc = (
  registry_id: number,
  kind: InnerDocumentDeclaration['kind'],
  order: number,
  extra: Partial<Pick<InnerDocumentDeclaration, 'bundle' | 'vars_field'>> = {}
): InnerDocumentDeclaration => ({
  extension_name: EXTENSION,
  registry_id,
  kind,
  approval: kind === 'service' ? 'none' : 'required',
  order,
  ...extra,
});

/**
 * Документы Капитала в реестре шаблонов кооператива.
 *
 * Положения и оферты наследуют ключи шагов онбординга (`blagorost_provision`,
 * `generator_offer_template`, …): реквизиты протокола пишутся в те же поля
 * `vars`, что подставляют шаблоны. Шаблоны-двойники «для утверждения» (995,
 * 997, 999) не объявляются: совет утверждает рабочий документ в бланке, а
 * поле `vars` сохраняет прежнее имя, чтобы тексты оферт не менять.
 */
export async function registerCapitalDocuments(port: IDocumentDeclarationPort): Promise<void> {
  await port.unregisterByExtension(EXTENSION);
  await port.registerDocuments([
    doc(R.GeneratorProgramTemplate.registry_id, 'provision', 10, { bundle: 'generator_program_template', vars_field: 'generator_program_template' }),
    doc(R.GenerationContract.registry_id, 'form', 20, { bundle: 'generation_contract_template', vars_field: 'generation_contract_template' }),
    doc(R.GeneratorOffer.registry_id, 'agreement', 30, { bundle: 'generator_offer_template', vars_field: 'generator_offer_template' }),
    doc(R.BlagorostProgramTemplate.registry_id, 'provision', 40, { bundle: 'blagorost_provision', vars_field: 'blagorost_provision' }),
    doc(R.BlagorostOffer.registry_id, 'agreement', 50, { bundle: 'blagorost_offer_template', vars_field: 'blagorost_offer_template' }),

    doc(R.ProjectGenerationContract.registry_id, 'form', 60, { bundle: 'capital_forms' }),
    doc(R.ComponentGenerationContract.registry_id, 'form', 61, { bundle: 'capital_forms' }),
    doc(R.StorageAgreement.registry_id, 'form', 62, { bundle: 'capital_forms' }),
    doc(R.InitProjectStatement.registry_id, 'form', 63, { bundle: 'capital_forms' }),
    doc(R.BlagorostAgreement.registry_id, 'form', 64, { bundle: 'capital_forms' }),
    doc(R.ExpenseStatement.registry_id, 'form', 65, { bundle: 'capital_forms' }),
    doc(R.GenerationMoneyInvestStatement.registry_id, 'form', 66, { bundle: 'capital_forms' }),
    doc(R.GenerationMoneyReturnUnusedStatement.registry_id, 'form', 67, { bundle: 'capital_forms' }),
    doc(R.CapitalizationMoneyInvestStatement.registry_id, 'form', 68, { bundle: 'capital_forms' }),
    doc(R.ResultContributionStatement.registry_id, 'form', 69, { bundle: 'capital_forms' }),
    doc(R.ResultContributionAct.registry_id, 'form', 70, { bundle: 'capital_forms' }),
    doc(R.GetLoanStatement.registry_id, 'form', 71, { bundle: 'capital_forms' }),
    doc(R.GenerationPropertyInvestStatement.registry_id, 'form', 72, { bundle: 'capital_forms' }),
    doc(R.GenerationPropertyInvestAct.registry_id, 'form', 73, { bundle: 'capital_forms' }),
    doc(R.CapitalizationPropertyInvestStatement.registry_id, 'form', 74, { bundle: 'capital_forms' }),
    doc(R.CapitalizationPropertyInvestAct.registry_id, 'form', 75, { bundle: 'capital_forms' }),
    doc(R.GenerationConvertStatement.registry_id, 'form', 76, { bundle: 'capital_forms' }),
    doc(R.CapitalizationToMainWalletConvertStatement.registry_id, 'form', 77, { bundle: 'capital_forms' }),

    doc(R.InitProjectDecision.registry_id, 'service', 90),
    doc(R.ExpenseDecision.registry_id, 'service', 91),
    doc(R.ResultContributionDecision.registry_id, 'service', 92),
    doc(R.GetLoanDecision.registry_id, 'service', 93),
    doc(R.GenerationPropertyInvestDecision.registry_id, 'service', 94),
    doc(R.CapitalizationPropertyInvestDecision.registry_id, 'service', 95),
  ]);
}
