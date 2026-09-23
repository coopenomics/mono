import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import {
  CONTRACT_BODY_HTML,
  CONTRACT_STYLE,
  STORAGE_TERMS_HTML,
  contractBodyTranslations,
} from './contract-body'

export const registry_id = 3006

/**
 * Экземпляр договора об участии преподавателя в хозяйственной деятельности
 * (УХД) по ЦПП «Образование». Текст договора — contract-body.ts;
 * здесь подставляются протокол утверждения рыбы, номер и дата договора,
 * реквизиты кооператива и пайщика. Подписывает преподаватель, вторую подпись
 * ставит председатель. Номер и дату договора вычисляет бэкенд edubridge.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Номер договора УХД. */
  /** Явно — при подписи со стола; иначе фабрика берёт из Udata */
  contract_number?: string
  /** Дата договора (дд.мм.гггг). */
  contract_created_at?: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  common_user: ICommonUser
  contract_number: string
  contract_created_at: string
}

export const title = 'Договор об участии в хозяйственной деятельности по ЦПП «ОБРАЗОВАНИЕ»'
export const description = 'Договор УХД преподавателя по ЦПП «ОБРАЗОВАНИЕ» по утверждённому шаблону'

const SOCIETY_REQUISITES = `<p><strong>{% trans 'society' %} / {{ vars.full_abbr }} «{{ vars.name }}» /:</strong></p>
<p>{% trans 'requisites_ids', coop.details.inn, coop.details.kpp, coop.details.ogrn %}</p>
<p>{% trans 'legal_address', coop.full_address %}</p>
<p>{% trans 'fact_address', coop.fact_address %}</p>
<p>{% trans 'contact_phone', coop.phone %}</p>
<p>{% trans 'email', coop.email %}</p>
<p>{% trans 'bank_account', coop.defaultBankAccount.account_number, coop.defaultBankAccount.bank_name, coop.defaultBankAccount.details.bik, coop.defaultBankAccount.details.corr %}</p>
<p>{% trans 'chairman_of', vars.full_abbr_genitive, vars.name %}</p>
<p>{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p>
<p>{% trans 'signed_electronically' %}</p>`

const MEMBER_REQUISITES = `<p><strong>{% trans 'member' %}:</strong></p>
<p>{{ common_user.full_name_or_short_name }}</p>
<p>{% trans 'contact_phone', common_user.phone %}</p>
<p>{% trans 'email', common_user.email %}</p>
<p>{% trans 'signed_electronically' %}</p>`

export const context = `${CONTRACT_STYLE}
<div class="digital-document">
<div class="approval">
<p>{% trans 'approved' %}</p>
<p>{% trans 'approved_by' %}</p>
<p>{{ vars.full_abbr_genitive }} «{{ vars.name }}»</p>
<p>{% trans 'protocol', vars.education_contract_template.protocol_number, vars.education_contract_template.protocol_day_month_year %}</p>
</div>
<div class="doc-head">
<h1>{% trans 'contract_title' %}</h1>
<p>{% trans 'contract_subtitle', contract_number %}</p>
</div>
<p>{% trans 'city_prefix', coop.city %}</p>
<p style="text-align: right">{{ contract_created_at }}</p>
<p>{% trans 'contract_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, common_user.full_name_or_short_name %}</p>
${CONTRACT_BODY_HTML}
<h3>{% trans 's10' %}</h3>
<div class="requisites">
${SOCIETY_REQUISITES}
${MEMBER_REQUISITES}
</div>
<div class="annex">
<p style="text-align: right">{% trans 'annex_to_contract', contract_number %}</p>
<p>{% trans 'city_prefix', coop.city %}</p>
<p style="text-align: right">{{ contract_created_at }}</p>
<p class="annex-title">{% trans 'storage_terms_title' %}</p>
<p>{% trans 'storage_terms_intro', contract_number, contract_created_at %}</p>
${STORAGE_TERMS_HTML}
<div class="requisites">
${SOCIETY_REQUISITES}
${MEMBER_REQUISITES}
</div>
</div>
<p>{{ meta.created_at }}</p>
</div>
`

export const translations = {
  ru: {
    ...contractBodyTranslations,
    signed_electronically: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  coop: {
    city: 'Москва',
    full_address: 'г. Москва, ул. Примерная, д. 1',
    fact_address: 'г. Москва, ул. Примерная, д. 1',
    phone: '+7 (900) 000-00-00',
    email: 'info@example.ru',
    details: { inn: '0000000000', kpp: '000000000', ogrn: '0000000000000' },
    defaultBankAccount: {
      account_number: '40703810000000000000',
      bank_name: 'ПАО Банк',
      details: { bik: '000000000', corr: '30101810000000000000' },
    },
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr: 'Потребительский Кооператив',
    full_abbr_genitive: 'Потребительского Кооператива',
    short_abbr: 'ПК',
    education_contract_template: { protocol_number: 'СС-01-09-26', protocol_day_month_year: '01 сентября 2026 г.' },
  },
  common_user: {
    full_name_or_short_name: 'Петров Пётр Петрович',
    phone: '+7 (900) 111-11-11',
    email: 'petrov@example.ru',
  },
  contract_number: 'УХД-0001',
  contract_created_at: '12.06.2026',
}
