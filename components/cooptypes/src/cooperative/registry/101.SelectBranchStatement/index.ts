import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'
import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '../../users'

export const registry_id = 101

/**
 * Интерфейс генерации заявления на выбор кооперативного участка
 */
export interface Action extends IGenerate {
  braname: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  type: string
  meta: IMetaDocument
  vars: IVars
  coop: ICooperativeData
  branch: IOrganizationData
  individual?: IIndividualData
  organization?: IOrganizationData
  entrepreneur?: IEntrepreneurData
}

export const title = 'Заявление пайщика о выборе кооперативного участка'
export const description = 'Форма заявления пайщика о выборе кооперативного участка'
export const context = '<style>\n.digital-document h1 {\nmargin: 0px;\ntext-align:center;\n}\n.digital-document {padding: 20px;}\n.subheader {\npadding-bottom: 20px;\n}\n</style>\n<div class="digital-document">\n<div style="text-align: right; margin:">\n<p style="margin: 0px !important">{% trans \'APPROVED\' %}</p>\n<p style="margin: 0px !important">{% trans \'protocol\' %} {{ vars.participant_application.protocol_number }}</p>\n<p style="margin: 0px !important">{{ coop.short_name }}</p>\n<p style="margin: 0px !important">{% trans \'from\' %} {{ vars.participant_application.protocol_day_month_year }}</p>\n</div>\n\n{% if type == \'individual\' %}\n<h1 class="header">{% trans \'participant_application\' %}</h1>\n<p style="text-align: center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p>\n<p style="text-align: right">{{ created_at }}, {{coop.city}}</p>\n\n<p>{% trans \'to_council_of\' %} {{vars.full_abbr_genitive}} «{{vars.name}}» {% trans \'from_participant\' %} {{ individual.last_name }} {{ individual.first_name }} {{ individual.middle_name }}. {% trans \'authorize_chairman_branch\', branch.short_name %}</p>\n<div class="signature">\n<p>{% trans \'signature\' %} </p>\n<p>{{ individual.last_name }} {{ individual.first_name }} {{ individual.middle_name }}</p>\n</div>\n\n{% elif type == \'entrepreneur\' %}\n<h1 class="header">{% trans \'participant_application\' %}</h1>\n<p style="text-align: center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p>\n<p style="text-align: right">{{ created_at }}, {{coop.city}}</p>\n\n<p>{% trans \'to_council_of\' %} {{vars.full_abbr_genitive}} «{{vars.name}}» {% trans \'from_participant\' %} {% trans \'ip\' %} {{ entrepreneur.last_name }} {{ entrepreneur.first_name }} {{ entrepreneur.middle_name }}. {% trans \'authorize_chairman_branch\', branch.short_name %}</p>\n<div class="signature">\n<p>{% trans \'signature\' %} </p>\n<p>{{ entrepreneur.last_name }} {{ entrepreneur.first_name }} {{ entrepreneur.middle_name }}</p>\n</div>\n{% elif type == \'organization\' %}\n<h1 class="header">{% trans \'participant_application\' %}</h1>\n<p style="text-align: center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p>\n<p style="text-align: right">{{ created_at }}, {{coop.city}}</p>\n<p>{% trans \'to_council_of\' %} {{vars.full_abbr_genitive}} «{{vars.name}}» {% trans \'from_participant\' %} {{organization.short_name}}. {% trans \'request_to_join_legal_entity\', organization.represented_by.position, organization.represented_by.last_name, organization.represented_by.first_name, organization.represented_by.middle_name, organization.represented_by.based_on, branch.short_name %}</p>\n<div class="signature">\n<p>{% trans \'signature\' %} </p>\n<p>{{ organization.represented_by.last_name }} {{ organization.represented_by.first_name }} {{ organization.represented_by.middle_name }}</p>\n</div>\n\n{% endif %}\n</div>'

export const translations = {
  ru: {
    from: 'от',
    to_council_of: 'В Совет',
    authorize_chairman_branch: 'Уполномочиваю Председателя кооперативного участка {0} представлять мои интересы и мой голос, как Пайщика Кооператива на Общих Собраниях Кооператива по всем вопросам с правом подписи, кроме получения причитающегося мне имущества и паевых взносов. Вышеуказанные полномочия передаются мной бессрочно на все время моего членства в Кооперативе. ',
    request_to_join_legal_entity: 'Заявитель, в лице представителя юридического лица - {0} {1} {2} {3}, действующий на основании {4}, уполномочивает Председателя кооперативного участка {5} представлять мои интересы и мой голос, как Пайщика Кооператива на Общих Собраниях Кооператива по всем вопросам с правом подписи, кроме получения причитающегося мне имущества и паевых взносов. Вышеуказанные полномочия передаются мной бессрочно на все время моего членства в Кооперативе. ',
    signature: 'Документ подписан электронной подписью',
    APPROVED: 'УТВЕРЖДЕНО',
    protocol: 'Протоколом Совета №',
    participant_application: 'Заявление пайщика',
    from_participant: 'от пайщика',
    ip: 'ИП',
  },
}

export const exampleData = {
  meta: {
    created_at: '04.03.2024 10:54',
  },
  coop: {
    city: 'Москва',
    short_name: 'ПК "ВОСХОД"',
  },
  individual: {
    last_name: 'Муравьев',
    first_name: 'Алексей',
    middle_name: 'Николаевич',
  },
  entrepreneur: {
    last_name: 'Муравьев',
    first_name: 'Алексей',
    middle_name: 'Николаевич',
  },
  organization: {
    represented_by: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
      position: 'директор',
      based_on: 'решения учредителей №1 от 05.03.2024',
    },
    short_name: 'ООО РОМАШКА',
  },
  type: 'individual',
  vars: {
    participant_application: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    full_abbr_genitive: 'потребительского кооператива',
    name: 'ВОСХОД',
  },
  branch: {
    short_name: 'РОМАШКА',
  },
}
