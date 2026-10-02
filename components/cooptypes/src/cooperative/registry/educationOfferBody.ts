import { translations as provisionTranslations } from './3000.EducationProgramTemplate'

/**
 * Оферты ЦПП «Образование» (3002 — ученика, 3004 — преподавателя) строятся из
 * Положения о ЦПП (3000) так же, как оферты «Благороста» и «Генератора» — из
 * своих положений: шапка утверждения, стороны, основание и акцепт, дальше —
 * условия Положения, изложенные как условия соглашения, и «Прочие условия».
 *
 * Текст условий берётся из Положения, а не переписывается: раздел о приёме в
 * Участники в оферту не входит (акцепт описан во вводной части), поэтому
 * разделы 4–6 Положения становятся разделами 3–5 оферты, а «настоящее
 * Положение» — «настоящим Пользовательским соглашением». Правка Положения
 * доезжает до обеих оферт сама.
 */

type Translations = Record<string, string>

/** Разделы Положения после выпавшего раздела 3 сдвигаются на один номер. */
const SECTION_SHIFT: Record<string, string> = { 4: '3', 5: '4', 6: '5' }

function renumber(text: string): string {
  return text
    .replace(/^([456])\. /, (_, n: string) => `${SECTION_SHIFT[n]}. `)
    .replace(/(?<!\d)(?<!\d\.)([456])\.(?=\d)/g, (_, n: string) => `${SECTION_SHIFT[n]}.`)
}

function toAgreement(text: string): string {
  return text
    .replace(/в настоящее Положение о ЦПП/g, 'в ЦПП')
    .replace(/, которая действует на основании настоящего Положения,/g, '')
    .replace(/настоящего Договора/g, 'настоящего Пользовательского соглашения')
    .replace(/настоящего Положения/g, 'настоящего Пользовательского соглашения')
    .replace(/настоящим Положением/g, 'настоящим Пользовательским соглашением')
    .replace(/настоящем Положении/g, 'настоящем Пользовательском соглашении')
}

/** Ключи Положения, которые входят в оферту: разделы 1–2 и 4–6. */
const SECTION_TITLES = ['c1', 'c17', 'c26', 'c46', 'c65']
const SKIPPED = ['c21', 'c22', 'c23', 'c24', 'c25']
const BODY_KEYS = Object.keys(provisionTranslations.ru)
  .filter(key => /^c\d+$/.test(key) && !SKIPPED.includes(key))
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))

const body: Translations = Object.fromEntries(
  BODY_KEYS.map(key => [key, renumber(toAgreement((provisionTranslations.ru as Translations)[key] as string))]),
)

const BODY_HTML = BODY_KEYS
  .map(key => SECTION_TITLES.includes(key)
    ? `<div style="text-align: center"><h3>{% trans '${key}' %}</h3></div>`
    : `<p>{% trans '${key}' %}</p>`)
  .join('')

/** Кто присоединяется: от этого зависят подзаголовок, вводная часть и термины. */
export interface EducationOfferParty {
  /** Поле vars с протоколом утверждения шаблона оферты. */
  templateVarsField: 'education_parent_offer_template' | 'education_teacher_offer_template'
  subtitle: string
  /** Дополнительный абзац вводной части; пусто — абзаца нет. */
  preambleNote?: string
  /** Термины, которые в этой оферте звучат иначе, чем в Положении. */
  terms: Translations
  /** Пункты раздела «Прочие условия» сверх общих. */
  extraFinalClauses?: string[]
}

export function buildEducationOffer(party: EducationOfferParty): { context: string, translations: { ru: Translations } } {
  const finalClauses = [
    'Общество и Участник в части их взаимоотношений, условия которых не предусмотрены настоящим Пользовательским соглашением, руководствуются взаимными договорами, внутренними нормативными документами Общества и законодательством Российской Федерации.',
    'Изменения и дополнения вносятся в настоящее Пользовательское соглашение и Положение Общества о ЦПП решением Совета Общества с учетом соблюдения прав ранее принявших его условия Участников. Участники, ранее принявшие условия ЦПП, изложенные в настоящем Пользовательском соглашении, вправе принять условия нового Положения Общества о ЦПП либо отказаться от участия в ЦПП.',
    ...(party.extraFinalClauses ?? []),
  ]
  const final: Translations = Object.fromEntries(
    finalClauses.map((text, i) => [`final_${i + 1}`, `<strong>6.${i + 1}.</strong> ${text}`]),
  )
  const finalHtml = Object.keys(final).map(key => `<p>{% trans '${key}' %}</p>`).join('')
  const preambleNote = party.preambleNote ? `<p>{% trans 'offer_preamble_note' %}</p>` : ''
  const vars = `vars.${party.templateVarsField}`

  const context = `<div class="digital-document"><div style="text-align: right"><p style="margin: 0px !important">{% trans 'approved_line_1' %}</p><p style="margin: 0px !important">{% trans 'approved_line_2', ${vars}.protocol_number %}</p><p style="margin: 0px !important">{{ vars.full_abbr_genitive }} «{{ vars.name }}»</p><p style="margin: 0px !important">{% trans 'approved_line_4', ${vars}.protocol_day_month_year %}</p></div><div style="text-align: center"><h1 class="header">{% trans 'OFFER_TITLE', agreement_number %}</h1><p class="subheader">{% trans 'offer_subtitle', vars.full_abbr_genitive, vars.name %}</p></div><p style="text-align: right">{{ agreement_created_at }}, {{ coop.city }}</p><p>{% trans 'offer_intro', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, common_user.full_name_or_short_name %}</p><p>{% trans 'offer_basis', vars.education_provision.protocol_number, vars.education_provision.protocol_day_month_year %}</p><p>{% trans 'offer_acceptance', common_user.full_name_or_short_name, vars.website %}</p>${preambleNote}${BODY_HTML}<div style="text-align: center"><h3>{% trans 'final_title' %}</h3></div>${finalHtml}<p style="margin: 0px !important">{% trans 'agreed_label' %} {{ common_user.full_name_or_short_name }}</p><p style="margin: 0px !important">{% trans 'signature_placeholder' %}</p><p style="margin: 0px !important">{{ created_at }}</p></div><style>.digital-document {padding: 20px;}.subheader {padding-bottom: 20px;}</style>`

  return {
    context,
    translations: {
      ru: {
        approved_line_1: 'УТВЕРЖДЕНО:',
        approved_line_2: 'Протоколом Совета № {0}',
        approved_line_4: 'от {0}',
        OFFER_TITLE: 'ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ (ОФЕРТА) № {0}',
        offer_subtitle: party.subtitle,
        offer_intro: '{0} «{1}» (далее «Общество») в лице Председателя Совета {2} {3} {4}, действующего на основании Устава, с одной стороны, и Пайщик Общества {5}, действующий на основании собственного волеизъявления, с другой стороны, а вместе Стороны, согласились с нижеследующим:',
        offer_basis: 'Настоящее Пользовательское соглашение, составленное в соответствии с Гражданским кодексом Российской Федерации, Уставом Общества и на основании Положения Общества о целевой потребительской программе «ОБРАЗОВАНИЕ», утвержденного Собранием Совета Общества (Протокол № {0} от {1}), формулирует соглашение между Обществом и Пайщиком, а также является по отношению к Пайщику Офертой от Общества, где Общество является Оферентом, а Пайщик является Акцептантом.',
        offer_acceptance: 'Отметка о Согласии {0} с настоящим Пользовательским соглашением производится электронно в Личном кабинете пайщика на сайте {1}, а дата подписания настоящего Пользовательского соглашения электронной подписью считается датой акцепта {0} настоящей Оферты по взаимодействию между Пайщиком и Обществом в соответствии с условиями целевой потребительской программы «ОБРАЗОВАНИЕ» (далее «ЦПП»). Акцептом настоящей Оферты Пайщик выражает свое полное согласие с условиями ЦПП «ОБРАЗОВАНИЕ», а именно:',
        ...(party.preambleNote ? { offer_preamble_note: party.preambleNote } : {}),
        ...body,
        c5: '<strong>Сайт</strong> - официальный сайт Общества, на котором опубликованы информация о ЦПП, текст Положения о ЦПП, текст настоящего Пользовательского соглашения, а также ЛК Участников, в которых они могут осуществлять управление своим участием в ЦПП;',
        ...party.terms,
        final_title: '6. Прочие условия',
        ...final,
        agreed_label: '«СОГЛАСЕН»',
        signature_placeholder: 'Подписано электронной подписью.',
      },
    },
  }
}

export const educationOfferExampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  created_at: '12.06.2026 12:00',
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
    full_abbr_genitive: 'Потребительского Кооператива',
    short_abbr: 'ПК',
    website: 'цифровой-кооператив.рф',
    education_provision: { protocol_number: 'СС-01-09-26', protocol_day_month_year: '01 сентября 2026 г.' },
    education_parent_offer_template: { protocol_number: 'СС-02-09-26', protocol_day_month_year: '02 сентября 2026 г.' },
    education_teacher_offer_template: { protocol_number: 'СС-02-09-26', protocol_day_month_year: '02 сентября 2026 г.' },
  },
  common_user: { full_name_or_short_name: 'Иванов Иван Иванович' },
  agreement_number: '12345',
  agreement_created_at: '12.06.2026',
}
