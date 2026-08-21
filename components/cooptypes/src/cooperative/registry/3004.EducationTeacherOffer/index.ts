import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 3004

/**
 * Экземпляр оферты преподавателя ЦПП «Образование» для конкретного пайщика
 * (рендерится из шаблона 3003.EducationTeacherOfferTemplate с подстановкой ФИО). Подписывает пайщик.
 * Номер и дату соглашения вычисляет бэкенд edubridge и передаёт явно.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Персональный номер соглашения. */
  agreement_number: string
  /** Дата соглашения (дд.мм.гггг). */
  agreement_created_at: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  common_user: ICommonUser
  agreement_number: string
  agreement_created_at: string
}

export const title = 'Соглашение (оферта) преподавателя о присоединении к ЦПП «ОБРАЗОВАНИЕ»'
export const description = 'Оферта преподавателя по ЦПП «ОБРАЗОВАНИЕ» для пайщика по утверждённому шаблону'

export const context = `<style>
h1 { margin: 0px; text-align: center; }
h3 { margin: 0px; padding-top: 15px; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
</style>

<div class="digital-document">
  <div style="text-align: center">
    <h1 class="header">{% trans 'OFFER_TITLE', agreement_number %}</h1>
    <p class="subheader">{% trans 'offer_subtitle', vars.name %}</p>
  </div>
  <p style="text-align: right">{{ agreement_created_at }}, {{ coop.city }}</p>

  <p>{% trans 'offer_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, common_user.full_name_or_short_name %}</p>

  <h3>{% trans 'c1' %}</h3>
  <p>{% trans 'c1_1' %}</p>
  <p>{% trans 'c1_2' %}</p>

  <h3>{% trans 'c2' %}</h3>
  <p>{% trans 'c2_1' %}</p>
  <p>{% trans 'c2_2' %}</p>

  <h3>{% trans 'c3' %}</h3>
  <p>{% trans 'c3_1' %}</p>

  <p>{% trans 'society_label' %} {{ vars.short_abbr }} «{{ vars.name }}», {% trans 'chairman_label' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p>
  <p>{% trans 'member_label' %} {{ common_user.full_name_or_short_name }}</p>
  <p>{% trans 'signature_placeholder' %}</p>
  <p>{{ meta.created_at }}</p>
</div>
`

export const translations = {
  ru: {
    OFFER_TITLE: 'СОГЛАШЕНИЕ (ОФЕРТА) № {0}',
    offer_subtitle: 'о присоединении преподавателя к целевой потребительской программе «Образование» {0}',
    offer_intro: '{0} «{1}» (далее Общество) в лице Председателя Совета {2} {3} {4}, действующего на основании Устава, с одной стороны, и пайщик Общества {5}, действующий на основании собственного волеизъявления, с другой стороны, согласились с нижеследующим:',
    c1: '1. Предмет соглашения',
    c1_1: '<strong>1.1.</strong> Пайщик присоединяется к целевой потребительской программе «Образование» на условиях Положения о ЦПП, утверждённого Советом Общества.',
    c1_2: '<strong>1.2.</strong> Пайщик участвует в ЦПП в качестве преподавателя: ведёт курсы на условиях договора об участии в хозяйственной деятельности и передаёт Обществу результаты интеллектуальной деятельности в качестве паевого взноса.',
    c2: '2. Взносы',
    c2_1: '<strong>2.1.</strong> Членские взносы по ЦПП вносятся путём конвертации паевого взноса по заявлению пайщика.',
    c2_2: '<strong>2.2.</strong> Паевые взносы пайщика учитываются на его лицевом счёте и возвращаются в порядке, установленном Уставом и внутренними документами Общества.',
    c3: '3. Срок действия',
    c3_1: '<strong>3.1.</strong> Соглашение вступает в силу с момента его подписания пайщиком и действует до выхода пайщика из ЦПП.',
    society_label: 'Общество:',
    chairman_label: 'Председатель Совета',
    member_label: 'Пайщик:',
    signature_placeholder: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  coop: {
    city: 'Москва',
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr: 'Потребительский Кооператив',
    short_abbr: 'ПК',
    website: 'цифровой-кооператив.рф',
  },
  common_user: { full_name_or_short_name: 'Иванов Иван Иванович' },
  agreement_number: '12345',
  agreement_created_at: '12.06.2026',
}
