import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 1107

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

// Модель данных документа — Положение о ЦПП «Стол заказов» для утверждения Советом.
// Это базовый учредительный документ программы (аналог 998.BlagorostProgramTemplate
// в Капитале): Совет утверждает Положение первым шагом онбординга ЦПП, после чего
// утверждается шаблон публичной оферты (1100.MarketplaceOfferTemplate), который
// нивелируется при регистрации пайщика либо предъявляется L3 fallback gate на столе.
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
}

export const title = 'Положение о целевой потребительской программе «СТОЛ ЗАКАЗОВ»'
export const description = 'Положение о ЦПП «СТОЛ ЗАКАЗОВ» для утверждения Советом'

// Placeholder context: финальная редакция Положения ЦПП «Стол заказов» готовится
// юридическим отделом (см. todo-tspp-templates.md). Структура повторяет
// 999.BlagorostOfferTemplate / 1100.MarketplaceOfferTemplate; замена будет одной
// правкой `context` + `translations` без изменения registry_id и подписей.
export const context = `<div class="digital-document"><div style="text-align: center"><h1 class="header">{% trans 'PROVISION_TITLE' %}</h1><p class="subheader">{% trans 'provision_subtitle' %}</p></div><p class="placeholder-notice"><em>{% trans 'placeholder_notice' %}</em></p><p>{% trans 'provision_intro_1' %} {{coop.chairman.last_name}} {{coop.chairman.first_name}} {{coop.chairman.middle_name}}{% trans 'provision_intro_2' %}</p><div style="text-align: center"><h3>{% trans 'general_title' %}</h3></div><p><strong>1.1.</strong> {% trans 'general_intro' %}</p><div style="text-align: center"><h3>{% trans 'terms_title' %}</h3></div><p><strong>2.1.</strong> {% trans 'platform_term_definition' %}</p><p><strong>2.2.</strong> {% trans 'order_term_definition' %}</p><p><strong>2.3.</strong> {% trans 'supply_term_definition' %}</p><p><strong>2.4.</strong> {% trans 'participant_term_definition' %}</p><div style="text-align: center"><h3>{% trans 'goals_title' %}</h3></div><p><strong>3.1.</strong> {% trans 'goals_intro' %}</p><div style="text-align: center"><h3>{% trans 'order_mechanism_title' %}</h3></div><p><strong>4.1.</strong> {% trans 'order_mechanism_intro' %}</p><div style="text-align: center"><h3>{% trans 'return_mechanism_title' %}</h3></div><p><strong>5.1.</strong> {% trans 'return_mechanism_intro' %}</p><div style="text-align: center"><h3>{% trans 'finance_title' %}</h3></div><p><strong>6.1.</strong> {% trans 'finance_intro' %}</p><div class="signature"><p style="margin-top: 40px;"><strong>{% trans 'provision_signature' %}</strong></p></div></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}.placeholder-notice {background: #fff3cd; padding: 10px; border-radius: 4px;}.subheader {padding-bottom: 20px;}.signature {padding-top: 20px;}</style>`

export const translations = {
  ru: {
    PROVISION_TITLE: 'ПОЛОЖЕНИЕ О ЦЕЛЕВОЙ ПОТРЕБИТЕЛЬСКОЙ ПРОГРАММЕ «СТОЛ ЗАКАЗОВ»',
    provision_subtitle:
      'Потребительского Кооператива "ВОСХОД", утверждаемое Советом Общества',
    placeholder_notice:
      'РЫБА ДОКУМЕНТА. Финальная редакция Положения ЦПП «Стол заказов» готовится юридическим отделом; до момента её утверждения этот документ занимает registry_id=1107 в платформенном реестре документов и используется как структурный заполнитель.',
    provision_intro_1:
      'Настоящее Положение о целевой потребительской программе "СТОЛ ЗАКАЗОВ" (далее — "Положение") принято Советом Потребительского Кооператива «ВОСХОД» в лице Председателя Совета ',
    provision_intro_2:
      ', действующего на основании Устава, в соответствии с Гражданским кодексом РФ и Уставом Общества.',
    general_title: '1. Общие положения [рыба]',
    general_intro:
      'Положение определяет цели, порядок организации и хозяйственный механизм целевой потребительской программы "СТОЛ ЗАКАЗОВ", в рамках которой пайщики совершают некоммерческий кооперативный обмен товарами.',
    terms_title: '2. Термины и определения [рыба]',
    platform_term_definition:
      '«Платформа» — информационная экосистема Цифрового кооператива, в которой реализована хозяйственная деятельность Общества в рамках ЦПП.',
    order_term_definition:
      '«Заказ» — потребительский паевой взнос Участника в рамках ЦПП с целью получения товара, поставленного другим Участником-поставщиком в режиме кооперативного некоммерческого обмена.',
    supply_term_definition:
      '«Поставка» — внесение Участником-поставщиком имущественного паевого взноса в виде товаров для дальнейшего распределения между Участниками-заказчиками.',
    participant_term_definition:
      '«Участник ЦПП (Участник)» — пайщик, подтвердивший намерение участвовать в хозяйственной деятельности Общества в рамках программы "СТОЛ ЗАКАЗОВ".',
    goals_title: '3. Цели и задачи [рыба]',
    goals_intro:
      'Целями ЦПП являются удовлетворение потребностей Участников в товарах для личного потребления и развитие некоммерческого обмена внутри Платформы.',
    order_mechanism_title: '4. Хозяйственный механизм заказа и поставки [рыба]',
    order_mechanism_intro:
      'Участник-заказчик направляет потребительский паевой взнос; Участник-поставщик принимает заказ и поставляет товар. Расчёты и поставки идут через Цифровой кошелёк Платформы.',
    return_mechanism_title: '5. Возврат и гарантийный возврат [рыба]',
    return_mechanism_intro:
      'Право требования возврата паевого взноса возникает при невыполнении поставки или ненадлежащем качестве товара в порядке, установленном настоящим Положением.',
    finance_title: '6. Финансовый и учётный порядок [рыба]',
    finance_intro:
      'Порядок учёта паевых взносов, распределения имущества и формирования отчётности устанавливается в соответствии с Уставом Общества и решениями Совета.',
    provision_signature:
      'Председатель Совета _____________________________ (ФИО) ____________________ (Подпись) ___________________ (Дата)',
  },
}

export const exampleData = {
  coop: {
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  vars: {
    name: 'ВОСХОД',
    short_abbr: 'ПК',
    website: 'цифровой-кооператив.рф',
    marketplace_program: {
      protocol_number: '01-05-2026',
      protocol_day_month_year: '01 мая 2026 г.',
    },
  },
}
