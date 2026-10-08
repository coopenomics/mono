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
 * Документы займов в реестре шаблонов кооператива: договор под обеспечение
 * паевым взносом, заявления о возврате и продлении. Заявление на получение
 * займа (1050), протокол решения (1051) и договор под имущество (1052)
 * объявляет Благорост — они общие с займом под коммиты.
 */
export async function registerDebtDocuments(port: IDocumentDeclarationPort): Promise<void> {
  await port.unregisterByExtension(EXTENSION);
  await port.registerDocuments([
    doc(R.LoanContractShare.registry_id, 'form', 10),
    doc(R.LoanRepaymentStatement.registry_id, 'form', 11),
    doc(R.LoanExtensionStatement.registry_id, 'form', 12),
  ]);
}
