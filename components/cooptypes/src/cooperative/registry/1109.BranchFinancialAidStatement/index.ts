import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1109

/**
 * Заявление доверенного/председателя кооперативного участка о выплате
 * материальной помощи (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Источник выплаты — персональный кошелёк членских средств получателя
 * (w.brn.person), пополняемый распределением членских взносов с
 * исполненных заказов участка. Получатель подписывает заявление сам и
 * сам оплачивает НДФЛ с полученной суммы — кооператив налог не
 * удерживает.
 *
 * Подписанное заявление уходит в `branch::createaid` и выносится на
 * повестку совета (type=brnaid): выплата денег из кооператива — его
 * компетенция. После положительного решения совет подписывает Протокол
 * (registry 1112), callback `branch::onaidauth` регистрирует исходящий
 * платёж в gateway, и заявка попадает к кассиру. Списание o.brn.aid
 * (Дт 86 / Кт 51) происходит в callback'е `branch::aidconfirm` после
 * подтверждения кассиром фактического банковского перевода.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Канонический идентификатор заявки on-chain (якорь к aids.hash). */
  aid_hash: string
  /** Кооперативный участок, средства которого распределены получателю. */
  braname: string
  /** Сумма выплаты (4 знака после запятой, валюта `_root_govern_symbol`). */
  amount: string
}

export type Meta = IMetaDocument & Action

/**
 * Модель данных для PDF-рендера Заявления на материальную помощь.
 * Подписант — сам получатель (доверенный/председатель участка).
 */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  aid_hash: string
  braname: string
  amount: string
}

export const title = 'Заявление на выплату материальной помощи'
export const description = 'Заявление доверенного лица кооперативного участка о выплате материальной помощи из числа распределённых ему членских взносов участка'

/**
 * ВАЖНО: тело документа (всё внутри `div.digital-document`) — ОДНОЙ строкой,
 * без переносов и отступов между тегами. Предпросмотр в приложении
 * (`BaseDocument` → shadow DOM) безусловно включает документу
 * `white-space: pre-wrap`, поэтому каждый перенос строки в исходнике шаблона
 * превращается в видимую пустую строку, а отступы — в пробелы. Вертикальный
 * ритм задают штатные поля абзацев, прижатые блоки — инлайн
 * `style="margin: 0px !important"`. См. `registry/CLAUDE.md`.
 */
export const context = `<style>
.digital-document h1 {
  margin: 0px;
  text-align: center;
}
.digital-document {
  padding: 20px;
}
.subheader {
  padding-bottom: 20px;
}
</style>
<div class="digital-document"><div style="text-align: right"><p style="margin: 0px !important">{% trans 'to_chairman' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p style="margin: 0px !important">{% trans 'from_member' %} {{ user.full_name_or_short_name }}</p></div><h1 class="header">{% trans 'statement_title' %}</h1><p class="subheader" style="text-align: center">{% trans 'statement_subheader' %}</p><p>{% trans 'body', amount %}</p><p>{% trans 'tax_note' %}</p><div class="signature"><p>{% trans 'signature' %}</p><p style="margin: 0px !important">{{ user.full_name_or_short_name }}</p><p style="margin: 0px !important">{{ meta.created_at }}</p></div></div>
`

export const translations = {
  ru: {
    to_chairman: 'Председателю',
    from_member: 'от пайщика',
    statement_title: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'о выплате материальной помощи',
    body: 'Прошу выплатить мне материальную помощь в размере {0}.',
    tax_note: 'Уведомлён(а), что налог на доходы физических лиц с полученной суммы оплачиваю самостоятельно.',
    signature: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: { created_at: '10.06.2026 12:00' },
  coop: {
    short_name: 'ПК ВОСХОД',
    city: 'Москва',
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  user: { full_name_or_short_name: 'Иванов Иван Иванович' },
  aid_hash: '0000abcd...',
  braname: 'KU-MOSKVA-1',
  amount: '5000.00 RUB',
}
