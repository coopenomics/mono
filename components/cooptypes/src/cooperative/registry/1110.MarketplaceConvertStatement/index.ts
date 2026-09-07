import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1110

/**
 * Заявление пайщика о переводе паевого взноса в ЦПП «Стол заказов» с уплатой
 * членского взноса (паевая модель, компонент 68, уточнения владельца
 * 06–07.09.2026). Текст — только слова владельца: «Прошу перевести с баланса
 * моего Цифрового кошелька на баланс Целевой Потребительской Программы
 * «Стол заказов» {amount}, из них членский взнос {membership_fee}».
 *
 * Два кошелька программы оплачивают каждый свою часть: свободный паевой
 * `w.mkt.share` — тело заказа, внутренний членский `w.mkt.member` — взнос
 * участка (туда возвращаются паевые и членские средства при отменах и
 * гарантийных возвратах). Заявление пишется только на то, чего в них не
 * хватило: {membership_fee} — взнос за вычетом остатка членского кошелька,
 * {amount} — недостающая часть тела сверх свободного паевого плюс
 * {membership_fee}. Подписывается отдельной транзакцией до заказа: действие
 * `marketplace::convert` переводит членскую часть в w.mkt.member
 * (o.mkt.conv), паевая часть уходит своим путём при создании заказа
 * (o.mkt.lock). Контракт публикует заявление в реестр документов
 * самостоятельным пакетом (package = hash).
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Якорь заявления: хеш оформления, бандла или заказа, к которому относится перевод. */
  order_hash: string
  /** Сумма перевода с Цифрового кошелька: недостающая часть тела плюс членская часть, с валютой. */
  amount: string
  /** Членская часть суммы (взнос минус остаток членского кошелька) — переводится действием convert, с валютой. */
  membership_fee: string
}

export type Meta = IMetaDocument & Action

/**
 * Модель данных для PDF-рендера Заявления о конвертации.
 * Подписант — пайщик-заказчик.
 */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  program: ICommonProgram
  order_hash: string
  amount: string
  membership_fee: string
}

export const title = 'Заявление о переводе паевого взноса в ЦПП «Стол заказов» с уплатой членского взноса'
export const description = 'Заявление пайщика о переводе паевого взноса в ЦПП «Стол заказов» на недостающую сумму с выделением членского взноса'

// Вёрстка 1-в-1 с эталоном фабричного документа 1106/1109, которые КОРРЕКТНО
// отображаются и в повестке совета (рендерер BaseDocument), и в предпросмотре.
// BaseDocument прогоняет html через sanitizeHtml — он ВЫРЕЗАЕТ содержимое
// <style> документа (инлайн-стили выживают, блочные правила — нет) и форсит в
// Shadow DOM `.digital-document { white-space: pre-wrap }`. Поэтому:
// выравнивание — ИНЛАЙН (`style="text-align: ..."`, а не класс в <style>),
// вертикальный ритм — ПУСТЫМИ СТРОКАМИ под pre-wrap (не margin'ами), плотные
// абзацы внутри одного блока (шапка «В Совет»/«от пайщика», подпись) — одной
// строкой переноса без пустой строки между ними. Свой <style> ниже нужен
// только для нешадоу-рендеров (weasyprint, предпросмотр без BaseDocument).
export const context = `<style>
h1 { margin: 0px; text-align: center; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
</style>

<div class="digital-document">
  <div style="text-align: right">
    <p style="margin: 0">{% trans 'v_soviet' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>
    <p style="margin: 0">{% trans 'from_member' %} {{ user.full_name_or_short_name }}</p>
  </div>

  <div style="text-align: center">
    <h1 class="header">{% trans 'statement_title' %}</h1>
    <p class="subheader">{% trans 'statement_subheader', program.name %}</p>
  </div>

  <p>{% trans 'body', program.name, amount, membership_fee %}</p>

  <p>{% trans 'signature' %}</p>
  <p>{{ user.full_name_or_short_name }}</p>
  <p>{{ meta.created_at }}</p>
</div>
`

export const translations = {
  ru: {
    v_soviet: 'В Совет',
    from_member: 'от пайщика',
    statement_title: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'о переводе паевого взноса в Целевую Потребительскую Программу «{0}» и уплате членского взноса',
    body: 'Прошу перевести с баланса моего Цифрового кошелька на баланс Целевой Потребительской Программы «{0}» {1}, из них членский взнос {2}.',
    signature: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  coop: {
    short_name: 'ПК ВОСХОД',
    city: 'Москва',
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  user: { full_name_or_short_name: 'Иванов Иван Иванович' },
  program: { name: 'СТОЛ ЗАКАЗОВ' },
  order_hash: '0000abcd...',
  amount: '910.0000 RUB',
  membership_fee: '210.0000 RUB',
}
