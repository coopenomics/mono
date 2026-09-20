import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 190

/** Кошелёк программы в таблице заявления. */
export interface IAnnulmentWallet {
  /** Машинное имя кошелька (`w.edu.member`). */
  wallet_name: string
  /** Человекочитаемое название кошелька. */
  human_name: string
  /** Остаток на день заявления («1000.0000 RUB»). */
  balance: string
  /** Остаток возвращается на главный паевой кошелёк. */
  returns: boolean
}

/** Программа в таблице заявления. */
export interface IAnnulmentProgram {
  program_id: number
  /** Название программы из реестра программ кооператива. */
  title: string
  /** Когда подписано соглашение об участии. */
  agreement_signed_at: string
  /** Хэш подписанного соглашения. */
  agreement_hash: string
  /** Кошельки программы с остатками. */
  wallets: IAnnulmentWallet[]
  /** Сколько возвращается по этой программе. */
  refund: string
}

/**
 * Заявление об аннулировании соглашений об участии в целевых потребительских
 * программах. Один документ на все программы пайщика: перечень программ
 * подставляется таблицей, отдельного бланка под каждую ЦПП нет.
 *
 * Подписывается вместе с заявлением на выход из кооператива (registry 200) —
 * тогда `exit_hash` связывает документы. Аннулирование одной программы без
 * выхода из кооператива идёт этим же документом без `exit_hash`.
 */
export interface Action extends IGenerate {
  /** Хэш процесса выхода; пусто — аннулирование без выхода из кооператива. */
  exit_hash?: string
  /**
   * Программы, соглашения по которым аннулируются, с остатками кошельков.
   * Собирает сервер по соглашениям пайщика и таблице политики кошельков:
   * суммы в документе справочные, к возврату контракт считает их заново на
   * день решения совета.
   */
  programs: IAnnulmentProgram[]
  /** Сумма к переводу на главный паевой кошелёк по всем программам. */
  total_refund: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  user: ICommonUser
  vars: IVars
  /** Пусто — аннулирование без выхода из кооператива. */
  exit_hash: string
  programs: IAnnulmentProgram[]
  /** Сумма к переводу на главный паевой кошелёк по всем программам. */
  total_refund: string
}

export const title = 'Заявление об аннулировании соглашений об участии в целевых потребительских программах'
export const description
  = 'Заявление пайщика о прекращении участия в целевых потребительских программах кооператива с переводом остатков кошельков программ на главный паевой кошелёк. Подписывается вместе с заявлением на выход из кооператива.'

// Вёрстка по канону документов реестра (см. 2010): без <style>-блока — превью
// его не применяет; только inline text-align на div-обёртках. Программы —
// нумерованным списком: название и дата соглашения, под ними кошельки с
// остатками и отметкой о возврате.
export const context = `<div class="digital-document"><div style="text-align: right"><p>{% trans 'TO_COUNCIL' %} {{ vars.full_abbr_genitive }} «{{ vars.name }}»</p><p>{% trans 'FROM_MEMBER' %} {{ user.full_name_or_short_name }}</p></div><div style="text-align: center"><h2>{% trans 'DOC_TITLE' %}</h2></div><p style="text-align: right">{{ coop.city }}, {{ meta.created_at }}</p><p>{% trans 'BODY_INTRO' %}{% if exit_hash %} {% trans 'BODY_WITH_EXIT' %}{% endif %}:</p>{% for program in programs %}<div style="padding-top: 10px"><p><strong>{{ loop.index }}. {{ program.title }}</strong></p><p>{% trans 'AGREEMENT_SIGNED_AT' %}: {{ program.agreement_signed_at }}</p>{% for wallet in program.wallets %}<p>{{ wallet.human_name }} — {{ wallet.balance }} ({% if wallet.returns %}{% trans 'WALLET_RETURNS' %}{% else %}{% trans 'WALLET_STAYS' %}{% endif %})</p>{% endfor %}</div>{% endfor %}<p style="padding-top: 10px">{% trans 'TOTAL_REFUND' %}: {{ total_refund }}.</p><p>{% trans 'REQUEST_TRANSFER' %}</p><p>{% trans 'NO_CLAIMS' %}</p><div style="padding-top: 30px"><p>{{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    TO_COUNCIL: 'В Совет',
    FROM_MEMBER: 'от пайщика',
    DOC_TITLE: 'ЗАЯВЛЕНИЕ ОБ АННУЛИРОВАНИИ СОГЛАШЕНИЙ ОБ УЧАСТИИ В ЦЕЛЕВЫХ ПОТРЕБИТЕЛЬСКИХ ПРОГРАММАХ',
    BODY_INTRO: 'Прошу аннулировать мои соглашения об участии в целевых потребительских программах Общества',
    BODY_WITH_EXIT: 'в связи с моим выходом из состава пайщиков',
    AGREEMENT_SIGNED_AT: 'Соглашение подписано',
    WALLET_RETURNS: 'возвращается на главный паевой кошелёк',
    WALLET_STAYS: 'остаётся Обществу по условиям Положения программы',
    TOTAL_REFUND: 'Итого к переводу на главный паевой кошелёк',
    REQUEST_TRANSFER: 'Прошу перевести указанные остатки на мой главный паевой кошелёк. Сумму перевода Общество определяет на день принятия решения Советом, поэтому она отличается от указанной выше на сумму движений по моим кошелькам после подписания заявления.',
    NO_CLAIMS: 'Подтверждаю, что к возврату мне причитаются остатки на кошельках перечисленных программ, и иных требований по этим программам к Обществу я не имею.',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: { city: 'Москва' },
  meta: { created_at: '20.09.2026 12:30' },
  vars: { full_abbr_genitive: 'ПК', name: 'Восход' },
  user: { full_name_or_short_name: 'Иванов Иван Иванович' },
  exit_hash: '55c470039a8c53ce1b4b6e842fe8063ab3d5b85ba2ba8ab0ae6e30be3ad328b7',
  programs: [
    {
      program_id: 5,
      title: 'Образование',
      agreement_signed_at: '02.09.2026',
      agreement_hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f801',
      wallets: [
        { wallet_name: 'w.edu.member', human_name: 'Членский взнос ЦПП «Образование»', balance: '10000.0000 RUB', returns: true },
      ],
      refund: '10000.0000 RUB',
    },
    {
      program_id: 2,
      title: 'Стол заказов',
      agreement_signed_at: '14.05.2026',
      agreement_hash: 'b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f801a2',
      wallets: [
        { wallet_name: 'w.mkt.share', human_name: 'Паевой взнос ЦПП «Стол заказов»', balance: '2500.0000 RUB', returns: true },
        { wallet_name: 'w.mkt.member', human_name: 'Членский взнос ЦПП «Стол заказов»', balance: '300.0000 RUB', returns: false },
      ],
      refund: '2500.0000 RUB',
    },
  ],
  total_refund: '12500.0000 RUB',
}
