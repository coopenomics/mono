import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1005

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  project_name: string
  project_hash: string
  component_name: string
  component_hash: string
  is_component: boolean
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  project_name: string
  project_hash: string
  component_name: string
  component_hash: string
  is_component: boolean
}

export const title = 'Заявление на инициализацию проекта'
export const description = 'Заявление на инициализацию проекта или компонента'

export const context = `<div class="digital-document"><div style="text-align: center"><h1>ЗАЯВЛЕНИЕ</h1><h2>на инициализацию проекта</h2></div><p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p><p>{% trans 'parties_intro' %} "{{ vars.name }}" {% trans 'in_face_of_chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}, {% trans 'acting_on_basis_of_charter' %}, {% trans 'hereinafter_referred_to_as' %} "{% trans 'society' %}", {% trans 'and_participant' %} {{ user.full_name_or_short_name }}, {% trans 'hereinafter_referred_to_as' %} "{% trans 'participant' %}", {% trans 'jointly_referred_to_as' %} "{% trans 'parties' %}", {% trans 'have_concluded_this_statement' %} {% trans 'hereinafter_referred_to_as' %} "{% trans 'statement' %}" {% trans 'of_the_following' %}:</p><p>{% if is_component %}{% trans 'participant_requests_component_init' %} "{{ component_name }}" (№{{ component_hash }}) {% trans 'as_part_of_project' %} "{{ project_name }}" (№{{ project_hash }}).{% else %}{% trans 'participant_requests_project_init' %} "{{ project_name }}" (№{{ project_hash }}).{% endif %}</p><h2>{% trans 'details_and_signatures_of_parties' %}</h2><p><strong>{% trans 'society' %}/{{ vars.full_abbr }} "{{ vars.name }}"/:</strong></p><p>ИНН {{ coop.details.inn }}, КПП {{ coop.details.kpp }}, ОГРН {{ coop.details.ogrn }}</p><p>{% trans 'legal_address' %}: {{ coop.full_address }}</p><p>{% trans 'contact_phone' %}: {{ coop.phone }}</p><p>{% trans 'email' %}: {{ coop.email }}</p><p>{% trans 'bank_account' %}: {{ coop.defaultBankAccount.account_number }}</p><p>{% trans 'bank_name' %}: {{ coop.defaultBankAccount.bank_name }}</p><p>{% trans 'bik' %}: {{ coop.defaultBankAccount.details.bik }}</p><p>{% trans 'correspondent_account' %}: {{ coop.defaultBankAccount.details.corr }}</p><p>{% trans 'chairman' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p>{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signed_by_digital_signature' %}</p><p><strong>{% trans 'participant' %}:</strong></p><p>{{ user.full_name_or_short_name }}</p><p>{% trans 'contact_phone' %}: {{ user.phone }}</p><p>{% trans 'email' %}: {{ user.email }}</p><p>{% trans 'signed_by_digital_signature' %}</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}</style>`

export const translations = {
  ru: {
    parties_intro: 'Потребительский Кооператив',
    in_face_of_chairman: 'в лице Председателя Совета',
    acting_on_basis_of_charter: 'действующего на основании Устава',
    hereinafter_referred_to_as: 'далее именуемый(-ая)',
    society: 'Общество',
    and_participant: 'и',
    participant: 'Пайщик',
    jointly_referred_to_as: 'совместно именуемые',
    parties: 'Стороны',
    have_concluded_this_statement: 'составили настоящее Заявление',
    statement: 'Заявление',
    of_the_following: 'о нижеследующем',
    participant_requests_component_init: 'Пайщик просит инициализировать Компонент',
    participant_requests_project_init: 'Пайщик просит инициализировать Проект',
    as_part_of_project: 'как составную часть Проекта',
    details_and_signatures_of_parties: 'РЕКВИЗИТЫ И ПОДПИСИ СТОРОН',
    legal_address: 'Юр. адрес',
    contact_phone: 'Контактный тел.',
    email: 'Электронная почта',
    bank_account: 'Р/с',
    bank_name: 'Банк',
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
  project_name: 'Проект цифровой платформы',
  project_hash: 'B2C3D4E5F6789ABC',
  component_name: 'Компонент разработки',
  component_hash: 'A1B2C3D4E5F6789A',
  is_component: true,
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
    full_abbr: 'Потребительский Кооператив',
  },
  user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
    abbr_full_name: 'Иванов И.И.',
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
    city: 'Москва',
  },
}
