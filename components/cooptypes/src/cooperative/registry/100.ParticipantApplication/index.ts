import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'
import type { IBankAccount } from '../../payments'
import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '../../users'

export const registry_id = 100

/**
 * Интерфейс генерации заявления на вступление в кооператив
 */
export interface Action extends IGenerate {
  braname?: string
  signature?: string
  skip_save: boolean
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  type: string
  individual?: IIndividualData
  organization?: IOrganizationData & { bank_account: IBankAccount }
  entrepreneur?: IEntrepreneurData
  coop: ICooperativeData
  branch?: IOrganizationData
  meta: IMetaDocument
  vars: IVars
  signature?: string
  initial?: string // тут опциональность только для сохранения обратной совмемости, после реализации версий моделей и конвееров можно будет удалить
  minimum?: string
  org_initial?: string
  org_minimum?: string
}

export const title = 'Заявление на вступление в кооператив'
export const description = 'Форма заявления на вступление в потребительский кооператив'
export const context = `<style>
.digital-document h1 {
margin: 0px;
text-align:center;
}
.digital-document {padding: 20px;}
.subheader {
padding-bottom: 20px;
}
</style>
<div class="digital-document">
<div style="text-align: right; margin:">
<p style="margin: 0px !important">{% trans 'APPROVED' %}</p>
<p style="margin: 0px !important">{% trans 'protocol' %} {{ vars.participant_application.protocol_number }}</p>
<p style="margin: 0px !important">{{ coop.short_name }}</p>
<p style="margin: 0px !important">{% trans 'from' %} {{ vars.participant_application.protocol_day_month_year }}</p>
</div>

{% if type == 'individual' %}
<h1 class="header">{% trans 'application_individual' %}</h1>
<p style="text-align: center" class="subheader">{% trans 'in' %} {{ coop.full_name }}<p>
<p style="text-align: right">{{ meta.created_at }}, {{coop.city}}</p>
<p>{% trans 'to_council_of' %} {{ coop.short_name }} {% trans 'from' %} {{ individual.last_name }} {{ individual.first_name }} {{ individual.middle_name }}, {% trans 'birthdate' %} {{ individual.birthdate }}, {% trans 'registration_address' %} {{ individual.full_address }}, {% trans 'phone_and_email_notice', individual.phone, individual.email %}{% if vars.passport_request == 'yes' %} {% trans 'passport' %} № {{individual.passport.series}} {{individual.passport.number}}, 
{% trans 'passport_code' %} {{individual.passport.code}}, {% trans 'passport_issued' %} {{individual.passport.issued_by}} {% trans 'passport_from' %} {{individual.passport.issued_at}}. {% endif %}</p>
<p>{% trans 'request_to_join' %} {{ coop.full_name }}. {% trans 'acknowledge_documents_individual' %} {% if coop.is_branched %}</p> 
<p>{% trans 'authorize_chairman_branch', branch.short_name %} {% endif %} </p>
<p>{% trans 'obligation_to_pay_individual',  initial, minimum %}</p>
<p>{% trans 'agreement_on_sms_email_notice_individual' %}</p>
<div class="signature">
<img style="max-width: 150px;" src="{{ signature }}"/>
<p>{% trans 'signature' %} </p>
<p style="text-align: right;">{{ individual.last_name }} {{ individual.first_name }} {{ individual.middle_name }}</p>
</div>

{% elif type == 'entrepreneur' %}
<h1 class="header">{% trans 'application_entrepreneur' %}</h1>
<p style="text-align: center">{% trans 'in' %} {{ coop.full_name }}<p>
<p style="text-align: right">{{ meta.created_at }}, {{coop.city}}</p>  <p>{% trans 'to_council_of' %} {{ coop.short_name }} {% trans 'from_entrepreneur' %} {{ entrepreneur.last_name }} {{ entrepreneur.first_name }} {{ entrepreneur.middle_name }}, {% trans 'birthdate' %} {{ entrepreneur.birthdate }}, {% trans 'registration_address' %} {{ entrepreneur.full_address }}, {% trans 'entrepreneur_details', entrepreneur.details.inn, entrepreneur.details.ogrn, entrepreneur.bank_account.account_number, entrepreneur.bank_account.details.corr, entrepreneur.bank_account.details.bik, entrepreneur.bank_account.bank_name %}, {% trans 'phone_and_email_notice', entrepreneur.phone, entrepreneur.email %}</p>
<p>{% trans 'request_to_join' %} {{ coop.full_name }}. {% trans 'acknowledge_documents_entrepreneur' %}</p> 
<p>{% if coop.is_branched %}{% trans 'authorize_chairman_branch', branch.short_name %} {% endif %} </p>
<p>{% trans 'obligation_to_pay_entrepreneur', initial, minimum %} </p>
<p>{% trans 'agreement_on_sms_email_notice_entrepreneur' %}</p>
<div class="signature">
<img style="max-width: 150px;" src="{{ signature }}"/>
<p>{% trans 'signature' %} </p>
<p style="text-align: right;">{{ entrepreneur.last_name }} {{ entrepreneur.first_name }} {{ entrepreneur.middle_name }}</p>
</div>

{% elif type == 'organization' %}
<h1 class="header">{% trans 'application_legal_entity' %}</h1>
<p style="text-align: center">{% trans 'in' %} {{ coop.full_name }}<p>
<p style="text-align: right">{{ meta.created_at }}, {{coop.city}}</p>
<p>{% trans 'to_council_of' %} «{{ coop.full_name }}» {% trans 'from_legal_entity' %} {{ organization.full_name }}, {% trans 'legal_address' %}: {{ organization.full_address }}, {% trans 'fact_address' %}: {{organization.fact_address}}, {% trans 'legal_entity_details', organization.details.inn, organization.details.ogrn, organization.bank_account.account_number, organization.bank_account.details.corr, organization.bank_account.details.bik, organization.bank_account.bank_name %}, {% trans 'phone_and_email_notice', organization.phone, organization.email %}</p>
<p>{% trans 'request_to_join_legal_entity', organization.represented_by.position, organization.represented_by.last_name, organization.represented_by.first_name, organization.represented_by.middle_name, organization.represented_by.based_on %} {{ coop.full_name }}.</p>
<p>{% trans 'acknowledge_documents_legal_entity' %}</p> 
<p>{% if coop.is_branched %}{% trans 'authorize_chairman_branch_organization', branch.short_name %} {% endif %}</p>
<p>{% trans 'obligation_to_pay_legal_entity', org_initial, org_minimum %}</p>
<p>{% trans 'agreement_on_sms_email_notice_legal_entity' %}</p>
<div class="signature">
<img style="max-width: 150px;" src="{{ signature }}"/>
<p>{% trans 'signature' %} </p>
<p style="text-align: right;">{{ organization.represented_by.last_name }} {{ organization.represented_by.first_name }} {{ organization.represented_by.middle_name }}</p>
</div>

{% endif %}
</div>`

export const translations = {
  ru: {
    from: 'от',
    application_individual: 'Заявление физического лица о приеме в пайщики',
    to_council_of: 'В Совет',
    birthdate: 'дата рождения',
    registration_address: 'адрес регистрации (как в паспорте): ',
    phone_and_email_notice: 'номер телефона с активированной функцией получения sms: {0}, адрес электронной почты: {1}.',
    acknowledge_documents_individual: 'Подтверждаю, что с Уставом и иными нормативными документами Общества ознакомлен(а).',
    agreement_on_sms_email_notice_individual: 'Выражаю свое согласие с тем, что информация, отправляемая Обществом в sms-сообщениях на указанный мной номер телефона, в сообщениях на указанный мной адрес электронной почты, или в PUSH уведомлениях с сайта, приравнивается к уведомлению меня Обществом в письменной форме.',
    application_entrepreneur: 'Заявление индивидуального предпринимателя о приеме в пайщики',
    from_entrepreneur: 'от индивидуального предпринимателя',
    acknowledge_documents_entrepreneur: 'Подтверждаю, что с Уставом и иными нормативными документами Общества ознакомлен(а).',
    agreement_on_sms_email_notice_entrepreneur: 'Выражаю свое согласие с тем, что информация, отправляемая Обществом в sms-сообщениях на указанный мной номер телефона, в сообщениях на указанный мной адрес электронной почты, или в PUSH уведомлениях с сайта, приравнивается к уведомлению меня Обществом в письменной форме.',
    application_legal_entity: 'Заявление юридического лица о приеме в пайщики',
    from_legal_entity: 'от юридического лица',
    legal_address: 'юридический адрес',
    legal_entity_details: 'ИНН {0}, ОГРН {1}, Р/с {2}, К/с {3}, БИК {4}, банк получателя {5}',
    acknowledge_documents_legal_entity: 'Подтверждает, что с Уставом и иными нормативными документами Общества ознакомлен.',
    agreement_on_sms_email_notice_legal_entity: 'Выражает свое согласие с тем, что информация, отправляемая Обществом в sms-сообщениях на указанный номер телефона, в сообщениях на указанный адрес электронной почты, или в PUSH уведомлениях с сайта, приравнивается к уведомлению Заявителя Обществом в письменной форме.',
    obligation_to_pay_individual: 'Обязуюсь своевременно внести в Общество вступительный {0} и минимальный паевой {1} взносы в порядке, предусмотренном Уставом Общества.',
    obligation_to_pay_entrepreneur: 'Обязуюсь своевременно внести в Общество вступительный {0} и минимальный паевой {1} взносы в порядке, предусмотренном Уставом Общества.',
    obligation_to_pay_legal_entity: 'Обязуется своевременно внести в Общество вступительный {0} и минимальный паевой {1} взносы в порядке, предусмотренном Уставом Общества.',
    entrepreneur_details: 'ИНН {0}, ОГРНИП {1}, Р/с {2}, К/с {3}, БИК {4}, банк получателя {5}',
    authorize_chairman_branch: 'Уполномочиваю Председателя кооперативного участка {0} принимать участие с правом голоса в Общих собраниях уполномоченных Общества, на период моего членства в Обществе при указанном кооперативном участке.',
    request_to_join_legal_entity: 'Заявитель, в лице представителя юридического лица - {0} {1} {2} {3}, действующий на основании {4}, просит принять в пайщики ',
    authorize_chairman_branch_organization: 'Уполномочивает Председателя кооперативного участка {0} принимать участие с правом голоса в Общих собраниях уполномоченных Общества, на период моего членства в Обществе при указанном кооперативном участке.',
    signature: 'подпись',
    in: 'в',
    request_to_join: 'Прошу принять меня в пайщики',
    APPROVED: 'УТВЕРЖДЕНО',
    protocol: 'Протоколом Совета №',
    passport: 'Паспорт',
    passport_code: 'код подразделения',
    passport_issued: 'выдан',
    passport_from: 'от',
    fact_address: 'фактический адрес',
  },
}

export const exampleData = {
  coop: {
    short_name: 'ПК "ВОСХОД"',
    full_name: 'потребительский кооператив "Восход"',
    city: 'Москва',
    is_branched: true,
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
    bank_account: {
      account_number: '234234234234',
      details: {
        corr: '234234234234234',
        bik: '234234234234',
      },
      bank_name: 'ПАО СБЕРБАНК',
    },
    phone: '+734534534534',
    email: 'email@gmail.com',
  },
  organization: {
    full_name: 'ООО РОМАШКА',
    full_address: 'Советов 3-84',
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
    },
    bank_account: {
      account_number: '23423423423423',
      details: {
        corr: '234234234234',
        bik: '234234234234',
      },
      bank_name: 'ПАО СБЕРБАНК',
    },
    phone: '+35345345345',
    email: 'an.mddf@gmail.com',
    fact_address: 'Советов 3-84',
  },
  type: 'individual',
  signature: '',
  vars: {
    participant_application: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    passport_request: 'yes',
  },
  branch: {
    short_name: 'РОМАШКА',
  },
  initial: '100.00 RUB',
  minimum: '300.00 RUB',
  org_initial: '1000.00 RUB',
  org_minimum: '3000.00 RUB',
}
