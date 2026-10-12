import type { IDocumentDeclarationPort, InnerDocumentDeclaration } from '@coopenomics/innercoop';
import { Cooperative } from 'cooptypes';

const R = Cooperative.Registry;
const EXTENSION = 'debt';

const doc = (registry_id: number, kind: InnerDocumentDeclaration['kind'], order: number): InnerDocumentDeclaration => ({
  extension_name: EXTENSION,
  registry_id,
  kind,
  approval: kind === 'service' ? 'none' : 'required',
  order,
  bundle: 'debt_forms',
});

/**
 * Документы займа под паевой взнос в реестре шаблонов кооператива: заявление,
 * договор займа, договор залога, акт передачи права в залог, заявления о
 * возврате и продлении. Протокол решения (1051), договор под имущество (1052)
 * и заявление займа Генерации (1058) объявляет Благорост.
 */
export async function registerDebtDocuments(port: IDocumentDeclarationPort): Promise<void> {
  await port.unregisterByExtension(EXTENSION);
  await port.registerDocuments([
    doc(R.GetLoanStatement.registry_id, 'form', 9),
    doc(R.LoanContractShare.registry_id, 'form', 10),
    doc(R.LoanPledgeContract.registry_id, 'form', 13),
    doc(R.LoanPledgeAct.registry_id, 'form', 14),
    doc(R.LoanRepaymentStatement.registry_id, 'form', 11),
    doc(R.LoanExtensionStatement.registry_id, 'form', 12),
  ]);
}
