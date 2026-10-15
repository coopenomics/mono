import type { IConfig } from '../../capital-extension.module';

/** Решения совета L1: положения и оферты «Генератора» и «Благороста», шаблон договора. */
export const CAPITAL_L1_COUNCIL_FLAGS = [
  'onboarding_generator_program_template_done',
  'onboarding_generation_contract_template_done',
  'onboarding_generator_offer_template_done',
  'onboarding_blagorost_provision_done',
  'onboarding_blagorost_offer_template_done',
] as const satisfies ReadonlyArray<keyof IConfig>;

type L1Config = Partial<Pick<IConfig, (typeof CAPITAL_L1_COUNCIL_FLAGS)[number] | 'capital_program_doc_data_hash'>>;

/** Все решения совета L1 приняты (или перенесены из прежних протоколов). */
export function isCapitalCouncilApproved(config: L1Config): boolean {
  return CAPITAL_L1_COUNCIL_FLAGS.every((flag) => Boolean(config[flag]));
}

/**
 * Подключение «Благороста» завершено: решения совета приняты И параметры
 * положений заполнены. Без параметров не собрать ни оферты вступающих, ни
 * документы регистрации участника — решения совета одни этого не дают
 * (кооператив мог перенести утверждения из прежних протоколов, а параметры
 * положений так и не задать). Одно правило на сервер и стол.
 */
export function isCapitalL1Complete(config: L1Config): boolean {
  return isCapitalCouncilApproved(config) && Boolean(config.capital_program_doc_data_hash?.trim());
}
