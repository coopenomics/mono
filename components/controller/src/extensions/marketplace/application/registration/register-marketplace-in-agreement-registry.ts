import { AccountType } from '~/application/account/enum/account-type.enum';
import type { AgreementRegistrationPort } from '~/domain/registration/ports/agreement-registration.port';
import {
  MARKETPLACE_AGREEMENT_TYPE,
  MARKETPLACE_EXTENSION_NAME,
  MARKETPLACE_OFFER_AGREEMENT_ID,
  MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID,
} from '../../constants/marketplace-agreement-ids';

/**
 * Регистрация оферты marketplace (Стол заказов) в платформенном AgreementRegistry.
 *
 * Чистая функция, не имеющая зависимостей от NestJS-контейнера — упрощает
 * unit-тестирование (по образцу `registerCapitalInAgreementRegistry`).
 *
 * Логика Story 1.2:
 *   • если `MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID ≤ 0` (template ещё не
 *     создан в document factory — Story 1.7 не выполнена) — port не вызывается,
 *     SignUp не предлагает оферту marketplace; функция возвращает false;
 *   • при реальном `registry_id > 0` — `registerAgreement` × 1 для оферты ЦПП
 *     «Стол заказов» с типами аккаунтов `individual` + `entrepreneur` + `organization`.
 *
 * Идемпотентность гарантируется самим `AgreementRegistryService` (повторный
 * register с тем же id+extension_name перезаписывает запись, см. док-комментарий
 * `AgreementRegistrationPort`).
 *
 * Programs для marketplace MVP не регистрируются: Стол заказов — это ЦПП без
 * программы участия (в отличие от Благороста с GENERATION/CAPITALIZATION).
 */
export function registerMarketplaceInAgreementRegistry(
  port: AgreementRegistrationPort
): boolean {
  if (MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID <= 0) {
    return false;
  }

  port.registerAgreement({
    id: MARKETPLACE_OFFER_AGREEMENT_ID,
    registry_id: MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID,
    agreement_type: MARKETPLACE_AGREEMENT_TYPE,
    title: 'Оферта по целевой потребительской программе «Стол заказов»',
    checkbox_text: 'Я прочитал и принимаю',
    link_text: 'оферту по целевой потребительской программе «Стол заказов»',
    applicable_account_types: [
      AccountType.individual,
      AccountType.entrepreneur,
      AccountType.organization,
    ],
    order: 7,
    extension_name: MARKETPLACE_EXTENSION_NAME,
  });

  return true;
}
