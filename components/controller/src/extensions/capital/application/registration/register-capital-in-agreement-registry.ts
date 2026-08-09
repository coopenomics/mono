import { Cooperative } from 'cooptypes';
import { AccountType } from '~/application/account/enum/account-type.enum';
import type { AgreementRegistrationPort } from '~/domain/registration/ports/agreement-registration.port';
import {
  BLAGOROST_AGREEMENT_TYPE,
  BLAGOROST_OFFER_AGREEMENT_ID,
  CAPITAL_EXTENSION_NAME,
  CAPITALIZATION_PROGRAM_KEY,
  GENERATION_PROGRAM_KEY,
  GENERATOR_AGREEMENT_TYPE,
  GENERATOR_OFFER_AGREEMENT_ID,
} from '../../constants/capital-agreement-ids';
import type { IConfig } from '../../capital-extension.module';

/**
 * Регистрация оферт и программ Capital в платформенном AgreementRegistry.
 *
 * Чистая функция, не имеющая зависимостей от плагина или nest-контейнера:
 * принимает `port` и `config`, выполняет series of register-вызовов.
 * Это упрощает unit-тестирование (не требует boot всей капитал-graph
 * с @octokit/rest, GitHub-схемами, базой и т.д.).
 *
 * Логика — Эпик 1.2 плана C28-10:
 *   • если L1-онбординг ещё не завершён (любой из 5 _done = false) —
 *     port не вызывается, реестр остаётся пустым для capital;
 *   • при завершённом L1 — две оферты (generator/blagorost) и две
 *     программы (generation/capitalization);
 *   • идемпотентность гарантируется AgreementRegistryService.
 *
 * `resolveDocDataHash` — резолвер hash'а PrivateData параметров ЦПП,
 * прикрепляется к обеим офертам: их фабричные шаблоны (#996/#1000) требуют
 * doc_data. Сейчас все документы ЦПП читают единый набор параметров
 * (capital_program_doc_data_hash); если параметры разделятся по программам,
 * каждая спека получит собственный резолвер — ядро менять не потребуется.
 */
export function registerCapitalInAgreementRegistry(
  port: AgreementRegistrationPort,
  extensionConfig: IConfig,
  resolveDocDataHash?: () => Promise<string | undefined>
): boolean {
  const onboardingDone =
    extensionConfig.onboarding_generator_program_template_done &&
    extensionConfig.onboarding_generation_contract_template_done &&
    extensionConfig.onboarding_generator_offer_template_done &&
    extensionConfig.onboarding_blagorost_provision_done &&
    extensionConfig.onboarding_blagorost_offer_template_done;

  if (!onboardingDone) {
    return false;
  }

  port.registerAgreement({
    id: GENERATOR_OFFER_AGREEMENT_ID,
    registry_id: Cooperative.Registry.GeneratorOffer.registry_id,
    agreement_type: GENERATOR_AGREEMENT_TYPE,
    title: 'Оферта по целевой потребительской программе "Генератор"',
    checkbox_text: 'Я прочитал и принимаю',
    link_text: 'оферту по целевой потребительской программе "Генератор"',
    applicable_account_types: [],
    order: 6,
    extension_name: CAPITAL_EXTENSION_NAME,
    resolve_doc_data_hash: resolveDocDataHash,
  });

  port.registerAgreement({
    id: BLAGOROST_OFFER_AGREEMENT_ID,
    registry_id: Cooperative.Registry.BlagorostOffer.registry_id,
    agreement_type: BLAGOROST_AGREEMENT_TYPE,
    title: 'Оферта по целевой потребительской программе "Благорост"',
    checkbox_text: 'Я прочитал и принимаю',
    link_text: 'оферту по целевой потребительской программе "Благорост"',
    // applicable_account_types: пусто — оферта подтягивается ТОЛЬКО через
    // программу CAPITALIZATION (agreement_ids ниже), не как дефолтная
    // для individual. Иначе при выборе GENERATION бэк попытался бы
    // сгенерить blagorost_offer как дефолтную, но generateDocumentParameters
    // под GENERATION зовёт только generateGeneratorOfferParameters →
    // Factory падает «Данные соглашения благороста не найдены в Udata».
    applicable_account_types: [],
    order: 5,
    extension_name: CAPITAL_EXTENSION_NAME,
    resolve_doc_data_hash: resolveDocDataHash,
  });

  port.registerProgram({
    key: GENERATION_PROGRAM_KEY,
    title: 'Программа Генерация',
    description:
      'Участвовать в производстве Кооперативной Экономики через паевой взнос временем, имуществом или деньгами в конкретные проекты.',
    applicable_account_types: [AccountType.individual, AccountType.entrepreneur],
    agreement_ids: [GENERATOR_OFFER_AGREEMENT_ID],
    order: 1,
    extension_name: CAPITAL_EXTENSION_NAME,
  });

  port.registerProgram({
    key: CAPITALIZATION_PROGRAM_KEY,
    title: 'Программа Благорост',
    description:
      'Участвовать в производстве Кооперативной Экономики через паевой взнос имуществом или денег в систему. Минимальный паевой взнос 100 000 руб в течение 14 дней.',
    applicable_account_types: [AccountType.individual, AccountType.entrepreneur],
    agreement_ids: [BLAGOROST_OFFER_AGREEMENT_ID],
    order: 2,
    extension_name: CAPITAL_EXTENSION_NAME,
  });

  return true;
}
