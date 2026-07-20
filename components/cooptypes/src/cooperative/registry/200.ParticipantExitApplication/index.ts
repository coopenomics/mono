import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'
import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '../../users'

export const registry_id = 200

/**
 * Интерфейс генерации заявления на выход из состава пайщиков кооператива
 */
export interface Action extends IGenerate {
  skip_save: boolean
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  type: string
  individual?: IIndividualData
  organization?: IOrganizationData
  entrepreneur?: IEntrepreneurData
  coop: ICooperativeData
  meta: IMetaDocument
  vars: IVars
}

export const title = 'Заявление на выход из кооператива'
export const description = 'Форма заявления физического лица, индивидуального предпринимателя или юридического лица о выходе из состава пайщиков потребительского кооператива'
export const context = `<style>
.digital-document h1 {
margin: 0px;
text-align:center;
}
.digital-document {padding: 20px;}
.subheader {
padding-bottom: 20px;
}
.signature {
padding-top: 30px;
}
</style>
<div class="digital-document">

{% if type == 'individual' %}
<h1 class="header">{% trans 'application_exit_individual' %}</h1>
<p style="text-align: center" class="subheader">{% trans 'of_consumer_cooperative' %} {{ coop.full_name }}<p>
<p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p>
<p>{% trans 'to_council_of' %} {{ coop.full_name }} {% trans 'from' %} {{ individual.last_name }} {{ individual.first_name }} {{ individual.middle_name }}, {% trans 'birthdate' %} {{ individual.birthdate }}, {% trans 'registration_address' %} {{ individual.full_address }}, {% trans 'phone_and_email_notice', individual.phone, individual.email %}{% if vars.passport_request == 'yes' %} {% trans 'passport' %} № {{ individual.passport.series }} {{ individual.passport.number }}, {% trans 'passport_code' %} {{ individual.passport.code }}, {% trans 'passport_issued' %} {{ individual.passport.issued_by }} {% trans 'passport_from' %} {{ individual.passport.issued_at }}.{% endif %}</p>
<p>{% trans 'request_to_exit', coop.full_name, coop.details.ogrn, coop.details.inn, coop.details.kpp %}</p>
<p>{% trans 'obligation_to_settle_individual' %}</p>
<div class="signature">
<p>{% trans 'signed_electronically' %}</p>
<p style="text-align: right;">{{ individual.last_name }} {{ individual.first_name }} {{ individual.middle_name }}</p>
</div>

{% elif type == 'entrepreneur' %}
<h1 class="header">{% trans 'application_exit_entrepreneur' %}</h1>
<p style="text-align: center" class="subheader">{% trans 'of_consumer_cooperative' %} {{ coop.full_name }}<p>
<p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p>
<p>{% trans 'to_council_of' %} {{ coop.full_name }} {% trans 'from_entrepreneur' %} {{ entrepreneur.last_name }} {{ entrepreneur.first_name }} {{ entrepreneur.middle_name }}, {% trans 'birthdate' %} {{ entrepreneur.birthdate }}, {% trans 'registration_address' %} {{ entrepreneur.full_address }}, {% trans 'entrepreneur_details', entrepreneur.details.inn, entrepreneur.details.ogrn %}, {% trans 'phone_and_email_notice', entrepreneur.phone, entrepreneur.email %}</p>
<p>{% trans 'request_to_exit', coop.full_name, coop.details.ogrn, coop.details.inn, coop.details.kpp %}</p>
<p>{% trans 'obligation_to_settle_individual' %}</p>
<div class="signature">
<p>{% trans 'signed_electronically' %}</p>
<p style="text-align: right;">{{ entrepreneur.last_name }} {{ entrepreneur.first_name }} {{ entrepreneur.middle_name }}</p>
</div>

{% elif type == 'organization' %}
<h1 class="header">{% trans 'application_exit_legal_entity' %}</h1>
<p style="text-align: center" class="subheader">{% trans 'of_consumer_cooperative' %} {{ coop.full_name }}<p>
<p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p>
<p>{% trans 'to_council_of' %} {{ coop.full_name }} {% trans 'from_legal_entity' %} {{ organization.full_name }}, {% trans 'legal_address' %}: {{ organization.full_address }}, {% trans 'fact_address' %}: {{ organization.fact_address }}, {% trans 'legal_entity_details', organization.details.inn, organization.details.ogrn, organization.details.kpp %}, {% trans 'phone_and_email_notice', organization.phone, organization.email %}</p>
<p>{% trans 'request_to_exit_legal_entity', organization.represented_by.position, organization.represented_by.last_name, organization.represented_by.first_name, organization.represented_by.middle_name, organization.represented_by.based_on, organization.full_name, coop.full_name %}</p>
<p>{% trans 'obligation_to_settle_legal_entity' %}</p>
<div class="signature">
<p>{% trans 'signed_electronically' %}</p>
<p style="text-align: right;">{{ organization.represented_by.last_name }} {{ organization.represented_by.first_name }} {{ organization.represented_by.middle_name }}</p>
</div>

{% endif %}
</div>`

export const translations = {
  ru: {
    from: 'от',
    of_consumer_cooperative: 'Потребительского кооператива',
    to_council_of: 'В Совет',
    birthdate: 'дата рождения',
    registration_address: 'адрес регистрации (как в паспорте): ',
    phone_and_email_notice: 'номер телефона: {0}, адрес электронной почты: {1}.',
    application_exit_individual: 'Заявление физического лица о выходе из состава пайщиков',
    application_exit_entrepreneur: 'Заявление индивидуального предпринимателя о выходе из состава пайщиков',
    application_exit_legal_entity: 'Заявление юридического лица о выходе из состава пайщиков',
    from_entrepreneur: 'от индивидуального предпринимателя',
    from_legal_entity: 'от юридического лица',
    legal_address: 'юридический адрес',
    fact_address: 'фактический адрес',
    entrepreneur_details: 'ИНН {0}, ОГРНИП {1}',
    legal_entity_details: 'ИНН {0}, ОГРН {1}, КПП {2}',
    request_to_exit: 'В соответствии с Уставом {0} (ОГРН {1}, ИНН {2}, КПП {3}) (далее по тексту Общество) прошу вывести меня из состава пайщиков Общества.',
    request_to_exit_legal_entity: 'Заявитель, в лице представителя юридического лица — {0} {1} {2} {3}, действующего на основании {4}, в соответствии с Уставом Общества просит вывести {5} из состава пайщиков {6}.',
    obligation_to_settle_individual: 'Обязуюсь погасить все свои обязательства перед Обществом, при наличии таковых, а также получить возврат своих паевых взносов в связи с моим участием в хозяйственной деятельности и целевых потребительских программах Общества, предусмотренном Уставом Общества и его действующих Положений и в соответствии с действующим законодательством РФ.',
    obligation_to_settle_legal_entity: 'Заявитель обязуется погасить все свои обязательства перед Обществом, при наличии таковых, а также получить возврат своих паевых взносов в связи с участием в хозяйственной деятельности и целевых потребительских программах Общества, предусмотренном Уставом Общества и его действующих Положений и в соответствии с действующим законодательством РФ.',
    signed_electronically: 'Документ подписан электронной подписью.',
    passport: 'Паспорт',
    passport_code: 'код подразделения',
    passport_issued: 'выдан',
    passport_from: 'от',
  },
}

export const exampleData = {
  coop: {
    short_name: 'ПК "ВОСХОД"',
    full_name: 'потребительский кооператив "Восход"',
    city: 'Москва',
    details: {
      inn: '9728130611',
      ogrn: '1247700283346',
      kpp: '772801001',
    },
  },
  meta: {
    created_at: '04.03.2024 10:54',
  },
  individual: {
    last_name: 'Муравьев',
    first_name: 'Алексей',
    middle_name: 'Николаевич',
    birthdate: '04.03.1990',
    phone: '790343432423',
    email: 'email@gmail.com',
    full_address: 'Советов 3-84',
    passport: {
      series: '7712',
      number: '122112',
      issued_by: 'отделом УФМС г. Москва',
      issued_at: '10.05.2010',
      code: '220-220',
    },
  },
  entrepreneur: {
    last_name: 'Муравьев',
    first_name: 'Алексей',
    middle_name: 'Николаевич',
    birthdate: '04.03.1990',
    full_address: 'Советов 3-84',
    details: {
      inn: '34534534534',
      ogrn: '345345345',
    },
    phone: '+734534534534',
    email: 'email@gmail.com',
  },
  organization: {
    full_name: 'ООО РОМАШКА',
    full_address: 'Советов 3-84',
    fact_address: 'Советов 3-84',
    represented_by: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
      position: 'директор',
      based_on: 'решения учредителей №1 от 05.03.2024',
    },
    details: {
      inn: '234234234',
      ogrn: '234234234234',
      kpp: '772801001',
    },
    phone: '+35345345345',
    email: 'an.mddf@gmail.com',
  },
  type: 'individual',
  vars: {
    passport_request: 'yes',
  },
}
