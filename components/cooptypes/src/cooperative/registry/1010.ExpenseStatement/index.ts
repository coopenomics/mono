import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1010

/**
 * Интерфейс генерации служебной записки по расходам программы «Благорост».
 * Соответствует бумажному шаблону 1010 (см. `~/blago/production/shared/1010.СлужебнаяЗапискаПоРасходам.pdf`).
 */
export interface Action extends IGenerate {
  registry_id: number
  statement_number: string
  project_name: string
  project_hash: string
  component_name: string
  component_hash: string
  deadline: string
  total_amount: string
  items: string[]
  position: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  statement_number: string
  project_name: string
  project_hash: string
  component_name: string
  component_hash: string
  deadline: string
  total_amount: string
  items: string[]
  position: string
}

export const title = 'Служебная записка по расходам программы Благорост'
export const description = 'Заявление пайщика в Совет кооператива о согласовании списания затрат по компоненту проекта из средств целевой программы «Благорост»'

export const context = `<style>
.digital-document { padding: 20px; white-space: pre-wrap; }
.digital-document p { margin: 0 0 8px 0; }
.header-right { text-align: right; }
.title { text-align: center; font-weight: bold; margin: 24px 0 16px 0; }
.items { padding-left: 32px; }
.items li { margin-bottom: 4px; }
.signature { display: flex; justify-content: space-between; margin-top: 32px; }
.signature .who { text-align: left; }
.signature .sig { text-align: right; }
</style>

<div class="digital-document">
<p class="header-right">{% trans 'addressee_council' %}<br/>{% trans 'addressee_coop_label' %} {{ vars.full_abbr }}<br/>"{{ vars.name }}"</p>
<p class="header-right">{% trans 'addressee_from' %} {{ user.full_name_or_short_name }}</p>
<p>{% trans 'date_label' %} {{ meta.created_at }}</p>
<p class="title">{% trans 'document_title', statement_number %}</p>
<p>{% trans 'preamble', component_name, project_name, deadline, total_amount %}</p>
<ol class="items">
{% for item in items %}<li>{{ item }}</li>
{% endfor %}
</ol>
<p>{% trans 'fund_clause' %}</p>
<div class="signature">
  <div class="who">{{ user.full_name_or_short_name }}<br/>{{ position }}</div>
  <div class="sig">{% trans 'signed_by_digital_signature' %}</div>
</div>
</div>`

export const translations = {
  ru: {
    addressee_council: 'В Совет Потребительского Кооператива',
    addressee_coop_label: '',
    addressee_from: 'от пайщика',
    date_label: 'Дата:',
    document_title: 'СЛУЖЕБНАЯ ЗАПИСКА № {0}',
    preamble:
      'Прошу согласовать списание затрат на реализацию Компонента "{0}", в рамках Проекта "{1}" в срок до {2}, согласно условий и из средств целевой потребительской программы "БЛАГОРОСТ" в общей сумме {3} руб., а именно:',
    fund_clause: 'по Фонду хозяйственной деятельности.',
    signed_by_digital_signature: 'Подписано электронной подписью',
  },
  en: {
    addressee_council: 'To the Council of the Consumer Cooperative',
    addressee_coop_label: '',
    addressee_from: 'from the participant',
    date_label: 'Date:',
    document_title: 'SERVICE MEMO No. {0}',
    preamble:
      'I request approval of expenses for implementation of Component "{0}", within Project "{1}" by {2}, in accordance with terms and from funds of the targeted consumer program "BLAGOROST" in the total amount of {3} RUB, namely:',
    fund_clause: 'from the Operating Activities Fund.',
    signed_by_digital_signature: 'Signed with electronic signature',
  },
}

export const exampleData = {
  meta: {
    created_at: '01.06.2026',
  },
  statement_number: '12',
  project_name: 'Цифровой кооператив',
  project_hash: 'B2C3D4E5F6789ABC',
  component_name: 'Платёжный шлюз',
  component_hash: 'A1B2C3D4E5F6789A',
  deadline: '31.07.2026',
  total_amount: '150 000',
  items: [
    'Оплата хостинга и доменных имён за июль 2026 г. — 30 000 руб.',
    'Закупка SSL-сертификатов на 12 мес. — 20 000 руб.',
    'Оплата работ подрядчика по интеграции — 100 000 руб.',
  ],
  position: 'Председатель Совета',
  vars: {
    name: 'ВОСХОД',
    full_abbr: 'Потребительский Кооператив',
  },
  user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
}
