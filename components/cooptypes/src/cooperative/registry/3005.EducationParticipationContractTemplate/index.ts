import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'
import { CONTRACT_BODY_HTML, CONTRACT_STYLE, STORAGE_TERMS_HTML, contractBodyTranslations } from './contract-body'

export const registry_id = 3005

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

/**
 * Шаблон договора об участии преподавателя в хозяйственной деятельности
 * (УХД) по ЦПП «Образование» для утверждения Советом. Аналог
 * 997.GenerationContractTemplate. РЫБА: реквизиты кооператива подставлены,
 * пайщик, номер, дата и протокол утверждения — прочерками. Текст договора
 * общий с экземпляром 3006 (см. contract-body.ts).
 */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
}

export const title = 'Договор об участии в хозяйственной деятельности по ЦПП «ОБРАЗОВАНИЕ»'
export const description = 'Шаблон договора УХД преподавателя по ЦПП «ОБРАЗОВАНИЕ» для утверждения Советом'

const BLANK = '______________'

const SOCIETY_REQUISITES = `<p><strong>{% trans 'society' %} / {{ vars.full_abbr }} «{{ vars.name }}» /:</strong></p>
<p>{% trans 'requisites_ids', coop.details.inn, coop.details.kpp, coop.details.ogrn %}</p>
<p>{% trans 'legal_address', coop.full_address %}</p>
<p>{% trans 'fact_address', coop.fact_address %}</p>
<p>{% trans 'contact_phone', coop.phone %}</p>
<p>{% trans 'email', coop.email %}</p>
<p>{% trans 'bank_account', coop.defaultBankAccount.account_number, coop.defaultBankAccount.bank_name, coop.defaultBankAccount.details.bik, coop.defaultBankAccount.details.corr %}</p>
<p>{% trans 'chairman_of', vars.full_abbr_genitive, vars.name %}</p>
<p>{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }} ${BLANK}</p>`

const MEMBER_REQUISITES = `<p><strong>{% trans 'member' %}:</strong></p>
<p>${BLANK}</p>
<p>{% trans 'contact_phone', '${BLANK}' %}</p>
<p>{% trans 'email', '${BLANK}' %}</p>
<p>${BLANK}</p>
<p>{% trans 'member_signature' %}</p>`

export const context = `${CONTRACT_STYLE}
<div class="digital-document">
<div class="approval">
<p>{% trans 'approved' %}</p>
<p>{% trans 'approved_by' %}</p>
<p>{{ vars.full_abbr_genitive }} «{{ vars.name }}»</p>
<p>{% trans 'protocol', '${BLANK}', '${BLANK}' %}</p>
</div>
<div class="doc-head">
<h1>{% trans 'contract_title' %}</h1>
<p>{% trans 'contract_subtitle', '${BLANK}' %}</p>
</div>
<p>{% trans 'city_prefix', coop.city %}</p>
<p style="text-align: right">${BLANK}</p>
<p>{% trans 'contract_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, '${BLANK}' %}</p>
${CONTRACT_BODY_HTML}
<h3>{% trans 's10' %}</h3>
<div class="requisites">
${SOCIETY_REQUISITES}
${MEMBER_REQUISITES}
</div>
<div class="annex">
<p style="text-align: right">{% trans 'annex_to_contract', '${BLANK}' %}</p>
<p>{% trans 'city_prefix', coop.city %}</p>
<p style="text-align: right">${BLANK}</p>
<p class="annex-title">{% trans 'storage_terms_title' %}</p>
<p>{% trans 'storage_terms_intro', '${BLANK}', '${BLANK}' %}</p>
${STORAGE_TERMS_HTML}
<div class="requisites">
${SOCIETY_REQUISITES}
${MEMBER_REQUISITES}
</div>
</div>
</div>
`

export const translations = {
  ru: {
    ...contractBodyTranslations,
  },
}

export const exampleData = {
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
  },
}
