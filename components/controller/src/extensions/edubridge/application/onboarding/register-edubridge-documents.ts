import type { IDocumentDeclarationPort, InnerDocumentDeclaration } from '@coopenomics/innercoop';
import { Cooperative } from 'cooptypes';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EDU_ONBOARDING_STEPS } from '../../constants/edubridge-agreement-ids';

const R = Cooperative.Registry;

const doc = (
  registry_id: number,
  kind: InnerDocumentDeclaration['kind'],
  order: number,
  extra: Partial<Pick<InnerDocumentDeclaration, 'bundle' | 'vars_field'>> = {}
): InnerDocumentDeclaration => ({
  extension_name: EDUBRIDGE_EXTENSION_NAME,
  registry_id,
  kind,
  approval: kind === 'service' ? 'none' : 'required',
  order,
  ...extra,
});

/**
 * Документы ЦПП «Образование» в реестре шаблонов кооператива. Без этого
 * объявления шаблон в реестре кооператива не появляется, и совет его не
 * утверждает — а неутверждённой редакцией документ не выпустить.
 *
 * Положение, обе оферты и договор участия наследуют ключи шагов онбординга:
 * под теми же именами совет утверждает их редакции, и под ними же текст
 * подставляется в документы пайщиков. Шаблоны-двойники 3001, 3003 и 3005 не
 * объявляются: совет утверждает рабочие документы (3002, 3004, 3006) в
 * бланке, где поля пайщика стоят прочерком.
 */
export async function registerEdubridgeDocuments(port: IDocumentDeclarationPort): Promise<void> {
  await port.unregisterByExtension(EDUBRIDGE_EXTENSION_NAME);
  await port.registerDocuments([
    doc(R.EducationProgramTemplate.registry_id, 'provision', 10, {
      bundle: EDU_ONBOARDING_STEPS.PROVISION,
      vars_field: EDU_ONBOARDING_STEPS.PROVISION,
    }),
    doc(R.EducationParentOffer.registry_id, 'agreement', 20, {
      bundle: EDU_ONBOARDING_STEPS.PARENT_OFFER_TEMPLATE,
      vars_field: EDU_ONBOARDING_STEPS.PARENT_OFFER_TEMPLATE,
    }),
    doc(R.EducationTeacherOffer.registry_id, 'agreement', 21, {
      bundle: EDU_ONBOARDING_STEPS.TEACHER_OFFER_TEMPLATE,
      vars_field: EDU_ONBOARDING_STEPS.TEACHER_OFFER_TEMPLATE,
    }),
    doc(R.EducationParticipationContract.registry_id, 'agreement', 22, {
      bundle: EDU_ONBOARDING_STEPS.CONTRACT_TEMPLATE,
      vars_field: EDU_ONBOARDING_STEPS.CONTRACT_TEMPLATE,
    }),

    doc(R.EducationCourseAnnex.registry_id, 'form', 30, { bundle: 'education_forms' }),
    doc(R.EducationConvertStatement.registry_id, 'form', 31, { bundle: 'education_forms' }),
    doc(R.EducationRidStorageAct.registry_id, 'form', 32, { bundle: 'education_forms' }),
    doc(R.EducationRidStatement.registry_id, 'form', 33, { bundle: 'education_forms' }),
    doc(R.EducationRidAct.registry_id, 'form', 34, { bundle: 'education_forms' }),

    doc(R.EducationRidDecision.registry_id, 'service', 90),
  ]);
}
