import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1007

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  common_user: ICommonUser
  blagorost_agreement_number: string
  contributor_contract_number: string
  contributor_contract_created_at: string
}

export const title = 'Соглашение о присоединении к целевой потребительской программе «БЛАГОРОСТ»'
export const description = 'Соглашение о присоединении к целевой потребительской программе БЛАГОРОСТ'

export const context = `<div class="digital-document"><p style="text-align: right; font-size: 14px">{% trans 'appendix_number' %} {{ blagorost_agreement_number }}</p><p style="text-align: right; font-size: 14px">{% trans 'to_agreement' %} № {{ contributor_contract_number }}</p><div style="text-align: center"><h1>{% trans 'agreement_title' %}</h1><p>{% trans 'agreement_subtitle' %}</p></div><p>{{ coop.city }}</p><p style="text-align: right">{{ meta.created_at }}</p><p>{% trans 'cooperative_name' %} "{{ vars.name }}", {% trans 'in_face_of_chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}, {% trans 'acting_on_basis_of_charter' %}, {% trans 'hereinafter_referred_to_as' %} "{% trans 'society' %}", {% trans 'and_participant' %} {{ common_user.full_name_or_short_name }}, {% trans 'hereinafter_referred_to_as' %} "{% trans 'participant' %}", {% trans 'acting_on_own_behalf' %}, {% trans 'jointly_referred_to_as' %} "{% trans 'parties' %}", {% trans 'have_concluded_this_agreement' %} {% trans 'hereinafter_referred_to_as' %} "{% trans 'agreement' %}" {% trans 'of_the_following' %}:</p><p><strong>1.</strong> {% trans 'blagorost_program_approved' %} ({% trans 'protocol' %} №{{ vars.blagorost_program.protocol_number }} {% trans 'from_date' %} {{ vars.blagorost_program.protocol_day_month_year }}).</p><p><strong>2.</strong> {% trans 'participant_accepts_goals' %}.</p><p><strong>3.</strong> {% trans 'participant_agrees_with_principles' %}.</p><p><strong>4.</strong> {% trans 'agreement_effective_date' %} № {{ contributor_contract_number }} {% trans 'from_date' %} {{ contributor_contract_created_at }}, {% trans 'agreement_spread_to_main_contract' %}.</p><p><strong>5.</strong> {% trans 'as_well_as_regulations' %}. {% trans 'agreement_copies' %} № {{ contributor_contract_number }} {% trans 'from_date' %} {{ contributor_contract_created_at }} {% trans 'and_stored_with_it' %}.</p><p><strong>{% trans 'society' %}/{{ vars.full_abbr }} "{{ vars.name }}"/:</strong></p><p>{% trans 'inn' %} {{ coop.details.inn }}, {% trans 'kpp' %} {{ coop.details.kpp }}, {% trans 'ogrn' %} {{ coop.details.ogrn }}</p><p>{% trans 'legal_address' %}: {{ coop.full_address }}</p><p>{% trans 'contact_phone' %}: {{ coop.phone }}</p><p>{% trans 'email' %}: {{ coop.email }}</p><p>{% trans 'bank_account' %}: {{ coop.defaultBankAccount.account_number }} {% trans 'in_bank' %} {{ coop.defaultBankAccount.bank_name }}, {% trans 'bik' %} {{ coop.defaultBankAccount.details.bik }}</p><p>{% trans 'correspondent_account' %}: {{ coop.defaultBankAccount.details.corr }}</p><p>{% trans 'chairman' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p>{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signed_by_digital_signature' %}</p><p><strong>{% trans 'participant' %}:</strong></p><p>{{ common_user.full_name_or_short_name }}</p><p>{% trans 'contact_phone' %}: {{ common_user.phone }}</p><p>{% trans 'email' %}: {{ common_user.email }}</p><p>{{ common_user.full_name_or_short_name }}</p><p>{% trans 'signed_by_digital_signature' %}</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}</style>`

export const translations = {
  ru: {
    appendix_number: 'ПРИЛОЖЕНИЕ №',
    to_agreement: 'к Договору об участии в хозяйственной деятельности',
    agreement_title: 'СОГЛАШЕНИЕ',
    agreement_subtitle: 'о присоединении к целевой потребительской программе «БЛАГОРОСТ»',
    blagorost_program_joining: 'Потребительское общество «{0}», именуемое в дальнейшем «Общество», в лице Председателя Совета Муравьева Алексея Николаевича, действующего на основании Устава, с одной стороны, и пайщик',
    cooperative_name: 'Потребительское общество',
    in_face_of_chairman: 'в лице Председателя Совета',
    acting_on_basis_of_charter: 'действующего на основании Устава',
    hereinafter_referred_to_as: 'именуемое в дальнейшем',
    society: 'Общество',
    and_participant: 'и',
    participant: 'Участник',
    acting_on_own_behalf: 'действующий(-ая) на основании собственного волеизъявления и от своего имени',
    jointly_referred_to_as: 'с другой стороны, совместно именуемые',
    parties: 'Стороны',
    have_concluded_this_agreement: 'заключили настоящее соглашение',
    agreement: 'Соглашение',
    of_the_following: 'о нижеследующем',
    blagorost_program_approved: 'Целевая программа «БЛАГОРОСТ» (далее "ЦПП") утверждена решением Совета Общества',
    protocol: 'протокол',
    from_date: 'от',
    participant_accepts_goals: 'Участник принимает все цели и задачи ЦПП, а также соглашается с принципами, хозяйственным механизмом и прочими положениями ЦПП',
    participant_agrees_with_principles: 'Настоящее Соглашение вступает в силу с момента его подписания обеими Сторонами',
    agreement_effective_date: 'На отношения Сторон по настоящему Соглашению распространяются все положения Договора об участии в хозяйственной деятельности',
    agreement_spread_to_main_contract: 'а также Положение «О целевой программе «БЛАГОРОСТ» и иные внутренние документы и регламенты Общества',
    as_well_as_regulations: 'Настоящее Соглашение составлено в двух экземплярах, имеющих равную юридическую силу, один экземпляр для Общества, второй экземпляр для Участника',
    agreement_copies: 'Соглашение, с момента его подписания обеими Сторонами, является неотъемлемой частью Договора об участии в хозяйственной деятельности',
    and_stored_with_it: 'и хранится вместе с ним',
    inn: 'ИНН',
    kpp: 'КПП',
    ogrn: 'ОГРН',
    legal_address: 'Юр. адрес',
    contact_phone: 'Контактный тел.',
    email: 'Электронная почта',
    bank_account: 'Р/с',
    in_bank: 'в',
    bik: 'БИК',
    correspondent_account: 'Корр/счет',
    chairman: 'Председатель Совета',
    signed_by_digital_signature: 'Подписано электронной подписью',
  },
}

export const exampleData = {
  meta: {
    created_at: '11.04.2024 12:00',
  },
  blagorost_agreement_number: 'BA001DEF456',
  contributor_contract_number: 'ED3BCFC5B681AA83D',
  contributor_contract_created_at: '11.04.2024',
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
    full_abbr: 'Потребительский Кооператив',
    blagorost_program: {
      protocol_number: 'СС-12-04-24',
      protocol_day_month_year: '12 апреля 2024 г.',
    },
  },
  common_user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
    email: 'ivanov@example.com',
    phone: '+7 999 123-45-67',
  },
  coop: {
    short_name: 'ПК "ВОСХОД"',
    details: {
      inn: '9728130611',
      kpp: '772801001',
      ogrn: '1247700283346',
    },
    full_address: '117593, г. МОСКВА, ВН.ТЕР.Г. МУНИЦИПАЛЬНЫЙ ОКРУГ ЯСЕНЕВО, ПРОЕЗД СОЛОВЬИНЫЙ, Д. 1, ПОМЕЩ. 1/1',
    phone: '+7 900 000-00-01',
    email: 'chairman@example.com',
    defaultBankAccount: {
      currency: 'RUB',
      bank_name: 'ПАО Сбербанк',
      account_number: '40703810038000110117',
      details: {
        bik: '044525225',
        corr: '30101810400000000225',
      },
    },
    chairman: {
      first_name: 'Алексей',
      last_name: 'Муравьев',
      middle_name: 'Николаевич',
    },
    city: 'г. Москва',
  },
}
