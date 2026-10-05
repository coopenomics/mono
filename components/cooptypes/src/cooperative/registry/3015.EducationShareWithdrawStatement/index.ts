import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import { EDUCATION_DOC_STYLE } from '../educationContractDocs'

export const registry_id = 3015

/**
 * Заявление преподавателя о трансляции паевого взноса из ЦПП «Образование» в
 * ЦПП «Цифровой Кошелёк» (процесс p.edu.rid, шаг `edubridge::wthshare`).
 *
 * Принятый результат зачисляется преподавателю паевым взносом на кошелёк
 * программы; вернуть взнос можно только с Цифрового Кошелька, поэтому
 * преподаватель сначала переводит туда весь остаток или его часть этим
 * заявлением. On-chain уходит параметром `statement` действия
 * `edubridge::wthshare`; денежно ему соответствует операция o.edu.wthshr
 * (TRANSFER w.edu.share → w.wal.share, без проводки).
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Сумма трансляции паевого взноса, с валютой. */
  amount: string
}

export type Meta = IMetaDocument & Action

/** Модель данных для PDF-рендера. Подписант — пайщик (преподаватель). */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  amount: string
}

export const title = 'Заявление о трансляции паевого взноса в Цифровой Кошелёк'
export const description = 'Заявление преподавателя о трансляции паевого взноса из ЦПП «Образование» в ЦПП «Цифровой Кошелёк»'

// Вёрстка 1-в-1 с 3011: тело одной строкой, отступы штатными полями абзацев.
export const context = `<div class="digital-document"><div style="text-align: right"><p style="margin: 0px !important">{% trans 'v_soviet' %} {{ vars.full_abbr_genitive }} «{{ vars.name }}»</p><p style="margin: 0px !important">{% trans 'from_member' %} {{ user.full_name_or_short_name }}</p></div><div style="text-align: center; padding-top: 20px"><h1 class="header">{% trans 'statement_title' %}</h1><p class="subheader">{% trans 'statement_subheader' %}</p></div><p>{% trans 'body', amount %}</p><div style="padding-top: 20px"><p style="margin: 0px !important">{% trans 'signature' %}</p><p style="margin: 0px !important">{{ user.full_name_or_short_name }}</p><p style="margin: 0px !important">{{ created_at }}</p></div></div>${EDUCATION_DOC_STYLE}`

export const translations = {
  ru: {
    v_soviet: 'В Совет',
    from_member: 'от пайщика',
    statement_title: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'о трансляции паевого взноса',
    body: 'Прошу транслировать мой паевой взнос по Целевой Потребительской Программе «Образование» в сумме {0} в Целевую Потребительскую Программу «Цифровой Кошелёк».',
    signature: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  created_at: '12.06.2026 12:00',
  coop: {
    short_name: 'ПК ВОСХОД',
    city: 'Москва',
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  user: { full_name_or_short_name: 'Иванов Иван Иванович' },
  amount: '3000.00 RUB',
}
