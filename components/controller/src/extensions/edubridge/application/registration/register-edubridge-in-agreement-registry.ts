import { InnerAccountType, type IRegistrationRegistryPort } from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import {
  EDU_LEARNING_PROGRAM_KEY,
  EDU_PARENT_AGREEMENT_TYPE,
  EDU_PARENT_OFFER_AGREEMENT_ID,
  EDU_PARENT_OFFER_REGISTRY_ID,
  EDU_TEACHER_AGREEMENT_TYPE,
  EDU_TEACHER_OFFER_AGREEMENT_ID,
  EDU_TEACHER_OFFER_REGISTRY_ID,
  EDU_TEACHING_PROGRAM_KEY,
} from '../../constants/edubridge-agreement-ids';

/**
 * Витрина вступления: две программы — «Обучение» (родитель-слушатель) и
 * «Преподавание», у каждой своя оферта. Вступающий выбирает одну; роль и
 * видимые столы выводятся из подписанной оферты. Оферты не предлагаются как
 * «дефолтные» — только через выбор программы.
 */
export function registerEdubridgeInAgreementRegistry(port: IRegistrationRegistryPort): void {
  port.registerAgreement({
    id: EDU_PARENT_OFFER_AGREEMENT_ID,
    registry_id: EDU_PARENT_OFFER_REGISTRY_ID,
    agreement_type: EDU_PARENT_AGREEMENT_TYPE,
    title: 'Оферта родителя-слушателя по целевой потребительской программе «Образование»',
    checkbox_text: 'Я прочитал и принимаю',
    link_text: 'оферту родителя-слушателя по ЦПП «Образование»',
    applicable_account_types: [],
    order: 8,
    extension_name: EDUBRIDGE_EXTENSION_NAME,
  });

  port.registerAgreement({
    id: EDU_TEACHER_OFFER_AGREEMENT_ID,
    registry_id: EDU_TEACHER_OFFER_REGISTRY_ID,
    agreement_type: EDU_TEACHER_AGREEMENT_TYPE,
    title: 'Оферта преподавателя по целевой потребительской программе «Образование»',
    checkbox_text: 'Я прочитал и принимаю',
    link_text: 'оферту преподавателя по ЦПП «Образование»',
    applicable_account_types: [],
    order: 9,
    extension_name: EDUBRIDGE_EXTENSION_NAME,
  });

  port.registerProgram({
    key: EDU_LEARNING_PROGRAM_KEY,
    title: 'Обучение',
    description: 'Записать себя или детей на курсы кооператива: членский взнос за выбранный период, доступ на образовательной площадке.',
    applicable_account_types: [InnerAccountType.individual, InnerAccountType.entrepreneur],
    agreement_ids: [EDU_PARENT_OFFER_AGREEMENT_ID],
    order: 4,
    extension_name: EDUBRIDGE_EXTENSION_NAME,
  });

  port.registerProgram({
    key: EDU_TEACHING_PROGRAM_KEY,
    title: 'Преподавание',
    description: 'Вести курсы кооператива и вносить паевой взнос результатами работы по договору участия в хозяйственной деятельности.',
    applicable_account_types: [InnerAccountType.individual, InnerAccountType.entrepreneur],
    agreement_ids: [EDU_TEACHER_OFFER_AGREEMENT_ID],
    order: 5,
    extension_name: EDUBRIDGE_EXTENSION_NAME,
  });
}
