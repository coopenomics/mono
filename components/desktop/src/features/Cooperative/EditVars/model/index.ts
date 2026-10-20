import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';
import { editVarsApi, type ICooperativeVarsInput } from '../api';

export type { ICooperativeVarsInput } from '../api';

/** Реквизиты протокола, которым совет утвердил документ. */
export interface IAgreementVarForm {
  protocol_number: string;
  protocol_day_month_year: string;
}

/**
 * Документы, реквизиты утверждения которых хранятся в параметрах. Порядок —
 * порядок показа на странице председателя.
 */
export const AGREEMENT_VAR_KEYS = [
  'wallet_agreement',
  'signature_agreement',
  'privacy_agreement',
  'user_agreement',
  'participant_application',
  'coopenomics_agreement',
] as const;
export type AgreementVarKey = (typeof AGREEMENT_VAR_KEYS)[number];

/** Обязательные строковые поля: пустыми сервер их не примет. */
export const REQUIRED_VAR_FIELDS = [
  'name',
  'full_abbr',
  'full_abbr_genitive',
  'full_abbr_dative',
  'short_abbr',
  'statute_link',
  'confidential_email',
] as const;

const agreementOf = (value: unknown): IAgreementVarForm => {
  const v = (value ?? {}) as Partial<IAgreementVarForm>;
  return { protocol_number: v.protocol_number ?? '', protocol_day_month_year: v.protocol_day_month_year ?? '' };
};

/**
 * Форма из текущих параметров кооператива: только поля, которые принимает сервер,
 * пустые значения — строками. Служебные поля ответа (`__typename`) и поля, которых
 * форма не знает, не уходят: сервер отверг бы весь запрос.
 */
/** Строковые поля ядра; пустые значения уходят пустой строкой. */
const STRING_VAR_FIELDS = [
  'name',
  'full_abbr',
  'full_abbr_genitive',
  'full_abbr_dative',
  'short_abbr',
  'website',
  'confidential_link',
  'confidential_email',
  'contact_email',
  'statute_link',
] as const;

export function toVarsForm(vars: Record<string, any> | null | undefined, coopname: string): ICooperativeVarsInput {
  // Имя кооператива обязательно: без него параметры принадлежат никому, и все
  // документы по ним собираются неверно. Сервер такие параметры тоже отвергнет.
  if (!coopname) throw new Error(t('cooperativeVars.coopnameMissing'));
  const v = vars ?? {};
  const strings = Object.fromEntries(STRING_VAR_FIELDS.map((key) => [key, v[key] ?? '']));
  const agreements = Object.fromEntries(AGREEMENT_VAR_KEYS.map((key) => [key, agreementOf(v[key])]));
  return {
    ...strings,
    ...agreements,
    coopname,
    passport_request: v.passport_request ?? 'no',
  } as ICooperativeVarsInput;
}

/** Есть ли в форме незаполненные обязательные поля. */
export function hasMissingRequired(form: Record<string, any>): boolean {
  return REQUIRED_VAR_FIELDS.some((key) => !String(form[key] ?? '').trim());
}

export function useEditCooperativeVars() {
  const systemStore = useSystemStore();

  const save = async (form: ICooperativeVarsInput): Promise<void> => {
    if (!form.coopname || form.coopname !== systemStore.info?.coopname) {
      throw new Error(t('cooperativeVars.coopnameMissing'));
    }
    const vars = { ...form };
    const platform = vars.coopenomics_agreement;
    if (!platform?.protocol_number && !platform?.protocol_day_month_year) delete vars.coopenomics_agreement;
    await editVarsApi.updateVars(vars);
    await systemStore.loadSystemInfo();
  };

  return { save };
}
