import { Cooperative } from 'cooptypes';
import {
  BLAGOROST_AGREEMENT_TYPE,
  BLAGOROST_OFFER_AGREEMENT_ID,
  CAPITAL_EXTENSION_NAME,
  CAPITALIZATION_PROGRAM_KEY,
  GENERATION_PROGRAM_KEY,
  GENERATOR_AGREEMENT_TYPE,
  GENERATOR_INTAKE_FORM_ID,
  GENERATOR_OFFER_AGREEMENT_ID,
} from '../../constants/capital-agreement-ids';
import {
  GENERATOR_INTAKE_DESCRIPTION,
  GENERATOR_INTAKE_TITLE,
  generatorIntakeJsonSchema,
} from './generator-intake.schema';
import type { IConfig } from '../../capital-extension.module';
import { type IRegistrationRegistryPort,
  InnerAccountType,
} from '@coopenomics/innercoop';
import { t } from '../../i18n';

/**
 * Анкета «Генератора»: без сопроводительного письма заявку в программу ядро не
 * примет. У «Благороста» анкеты нет — там участие имущественное.
 *
 * Через порт уходят данные, а не Zod-объект: JSON Schema с теми же описаниями
 * полей, по которой ядро и форму построит, и ответ проверит.
 */
function registerGeneratorIntakeForm(port: IRegistrationRegistryPort): void {
  port.registerIntakeForm({
    id: GENERATOR_INTAKE_FORM_ID,
    extension_name: CAPITAL_EXTENSION_NAME,
    title: GENERATOR_INTAKE_TITLE,
    description: GENERATOR_INTAKE_DESCRIPTION,
    schema: generatorIntakeJsonSchema(),
    applicable_account_types: [],
    order: 1,
  });
}

/** Программы участия capital: «Генерация» (с анкетой) и «Благорост». */
function registerCapitalPrograms(port: IRegistrationRegistryPort): void {
  port.registerProgram({
    key: GENERATION_PROGRAM_KEY,
    title: t('capital.agreementRegistry.generationProgram.title'),
    description:
      t('capital.agreementRegistry.generationProgram.description'),
    applicable_account_types: [InnerAccountType.individual, InnerAccountType.entrepreneur],
    agreement_ids: [GENERATOR_OFFER_AGREEMENT_ID],
    intake_form_ids: [GENERATOR_INTAKE_FORM_ID],
    order: 1,
    extension_name: CAPITAL_EXTENSION_NAME,
  });

  port.registerProgram({
    key: CAPITALIZATION_PROGRAM_KEY,
    title: t('capital.agreementRegistry.capitalizationProgram.title'),
    description:
      t('capital.agreementRegistry.capitalizationProgram.description'),
    applicable_account_types: [InnerAccountType.individual, InnerAccountType.entrepreneur],
    agreement_ids: [BLAGOROST_OFFER_AGREEMENT_ID],
    order: 2,
    extension_name: CAPITAL_EXTENSION_NAME,
  });
}

/**
 * Регистрация оферт и программ Capital в платформенном AgreementRegistry.
 *
 * Чистая функция, не имеющая зависимостей от расширения или nest-контейнера:
 * принимает `port` и `config`, выполняет series of register-вызовов.
 * Это упрощает unit-тестирование (не требует boot всей капитал-graph
 * с @octokit/rest, GitHub-схемами, базой и т.д.).
 *
 * Логика — Эпик 1.2 плана C28-10:
 *   • если L1-онбординг ещё не завершён (любой из 5 _done = false) —
 *     port не вызывается, реестр остаётся пустым для capital;
 *   • при завершённом L1 — две оферты (generator/blagorost), анкета
 *     «Генератора» (сопроводительное письмо) и две программы
 *     (generation/capitalization);
 *   • идемпотентность гарантируется AgreementRegistryService.
 *
 * `resolveDocDataHash` — резолвер hash'а PrivateData параметров ЦПП,
 * прикрепляется к обеим офертам: их фабричные шаблоны (#996/#1000) требуют
 * doc_data. Сейчас все документы ЦПП читают единый набор параметров
 * (capital_program_doc_data_hash); если параметры разделятся по программам,
 * каждая спека получит собственный резолвер — ядро менять не потребуется.
 */
export function registerCapitalInAgreementRegistry(
  port: IRegistrationRegistryPort,
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
    title: t('capital.agreementRegistry.generatorOffer.title'),
    checkbox_text: t('capital.agreementRegistry.generatorOffer.checkboxText'),
    link_text: t('capital.agreementRegistry.generatorOffer.linkText'),
    applicable_account_types: [],
    order: 6,
    extension_name: CAPITAL_EXTENSION_NAME,
    resolve_doc_data_hash: resolveDocDataHash,
  });

  port.registerAgreement({
    id: BLAGOROST_OFFER_AGREEMENT_ID,
    registry_id: Cooperative.Registry.BlagorostOffer.registry_id,
    agreement_type: BLAGOROST_AGREEMENT_TYPE,
    title: t('capital.agreementRegistry.blagorostOffer.title'),
    checkbox_text: t('capital.agreementRegistry.blagorostOffer.checkboxText'),
    link_text: t('capital.agreementRegistry.blagorostOffer.linkText'),
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

  registerGeneratorIntakeForm(port);

  registerCapitalPrograms(port);

  return true;
}
