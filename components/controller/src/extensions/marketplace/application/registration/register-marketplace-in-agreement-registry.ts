import {
  MARKETPLACE_AGREEMENT_TYPE,
  MARKETPLACE_EXTENSION_NAME,
  MARKETPLACE_OFFER_AGREEMENT_ID,
  MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID,
  MARKETPLACE_PROGRAM_KEY,
} from '../../constants/marketplace-agreement-ids';
import { ProgramKey, type IRegistrationRegistryPort,
  InnerAccountType,
} from '@coopenomics/innercoop';
import { t } from '../../i18n';

/**
 * Регистрация ЦПП «Стол заказов» в платформенном AgreementRegistry как
 * ВЫБИРАЕМОЙ программы (аналог Capital: Генерация/Благорост).
 *
 * Ключевое (фикс бага персонализации):
 *   • оферта регистрируется на `MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID`
 *     (1102.MarketplaceOffer — ПЕРСОНАЛЬНЫЙ инстанс с ФИО пайщика и номером),
 *     а НЕ на шаблоне 1101.MarketplaceOfferTemplate (его утверждает Совет, ФИО —
 *     прочерки). Раньше регистрировался шаблон → пайщик подписывал обезличенный
 *     документ.
 *   • `applicable_account_types: []` у оферты — она подтягивается ТОЛЬКО через
 *     выбор программы (как blagorost_offer), а не как дефолтная для всех.
 *   • `registerProgram` делает ЦПП пунктом выбора в SignUp. По её `key`
 *     (= `ProgramKey.MARKETPLACE`) registration-flow генерит персональные
 *     номер+дату оферты в Udata, которые читает фабрика 1102.
 *
 * Если `MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID ≤ 0` (ЦПП не активирована) —
 * ничего не регистрируем, функция возвращает false.
 *
 * Идемпотентность гарантирует `AgreementRegistryService`.
 */
export function registerMarketplaceInAgreementRegistry(
  port: IRegistrationRegistryPort
): boolean {
  if (MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID <= 0) {
    return false;
  }

  port.registerAgreement({
    id: MARKETPLACE_OFFER_AGREEMENT_ID,
    registry_id: MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID,
    agreement_type: MARKETPLACE_AGREEMENT_TYPE,
    title: t('marketplace.agreementRegistry.offerTitle'),
    checkbox_text: t('marketplace.agreementRegistry.acceptCheckboxLabel'),
    link_text: t('marketplace.agreementRegistry.offerObjectLabel'),
    // Пусто: подтягивается только через выбор программы ниже, не как дефолтная.
    applicable_account_types: [],
    order: 7,
    extension_name: MARKETPLACE_EXTENSION_NAME,
  });

  port.registerProgram({
    key: MARKETPLACE_PROGRAM_KEY,
    title: t('marketplace.agreementRegistry.programName'),
    description:
      t('marketplace.agreementRegistry.programDescription'),
    applicable_account_types: [
      InnerAccountType.individual,
      InnerAccountType.entrepreneur,
      InnerAccountType.organization,
    ],
    agreement_ids: [MARKETPLACE_OFFER_AGREEMENT_ID],
    order: 3,
    extension_name: MARKETPLACE_EXTENSION_NAME,
  });

  return true;
}
