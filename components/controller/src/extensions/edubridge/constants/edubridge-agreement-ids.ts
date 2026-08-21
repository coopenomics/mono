import { Cooperative } from 'cooptypes';
import { ProgramKey } from '@coopenomics/innercoop';

/** Идентификаторы оферт в реестре регистрации (namespace расширения). */
export const EDU_PARENT_OFFER_AGREEMENT_ID = 'education_parent_offer';
export const EDU_TEACHER_OFFER_AGREEMENT_ID = 'education_teacher_offer';

/** Виды программ в реестре кооператива (`soviet::coagreements`), eosio::name ≤ 12 символов. */
export const EDU_PARENT_AGREEMENT_TYPE = 'eduparent';
export const EDU_TEACHER_AGREEMENT_TYPE = 'eduteacher';

export const EDU_LEARNING_PROGRAM_KEY = ProgramKey.EDUCATION;
export const EDU_TEACHING_PROGRAM_KEY = ProgramKey.EDUCATION_TEACHING;

/** Документы реестра платформы (cooptypes 3000–3011). */
export const EDU_PROGRAM_TEMPLATE_REGISTRY_ID = Cooperative.Registry.EducationProgramTemplate.registry_id;
export const EDU_PARENT_OFFER_TEMPLATE_REGISTRY_ID = Cooperative.Registry.EducationParentOfferTemplate.registry_id;
export const EDU_PARENT_OFFER_REGISTRY_ID = Cooperative.Registry.EducationParentOffer.registry_id;
export const EDU_TEACHER_OFFER_TEMPLATE_REGISTRY_ID = Cooperative.Registry.EducationTeacherOfferTemplate.registry_id;
export const EDU_TEACHER_OFFER_REGISTRY_ID = Cooperative.Registry.EducationTeacherOffer.registry_id;
export const EDU_CONTRACT_TEMPLATE_REGISTRY_ID = Cooperative.Registry.EducationParticipationContractTemplate.registry_id;
export const EDU_CONTRACT_REGISTRY_ID = Cooperative.Registry.EducationParticipationContract.registry_id;

/** Шаги L1-онбординга (решения совета); ключи совпадают с полями vars кооператива. */
export const EDU_ONBOARDING_STEPS = {
  PROVISION: 'education_provision',
  PARENT_OFFER_TEMPLATE: 'education_parent_offer_template',
  TEACHER_OFFER_TEMPLATE: 'education_teacher_offer_template',
  CONTRACT_TEMPLATE: 'education_contract_template',
} as const;
