import { Cooperative, Debt } from 'cooptypes'
import type { DocFactory } from '../../Factory'
import { Udata } from '../../Models/Udata'
import { amountWithSymbolRu } from '../../Utils/amountDigits'
import type { InternalGetUserResult } from '../../Factory'
import type { ExternalEntrepreneurData, ExternalIndividualData, ExternalOrganizationData } from '../../Models'

/**
 * Общие данные документов беспроцентного займа: основание (договор об участии
 * или оферта программы — с номером и датой), сумма цифрами и прописью,
 * обеспечение словами и даты в виде для человека.
 *
 * Падежи основания нужны тексту: «Приложение к Договору…», «в соответствии с
 * Договором…», «условиями Договора…».
 */
export interface LoanBasis {
  basis_title_dative: string
  basis_title_genitive: string
  basis_title_instrumental: string
  basis_number: string
  basis_date: string
}

const UHD_FORMS = {
  dative: 'Договору об участии в хозяйственной деятельности',
  genitive: 'Договора об участии в хозяйственной деятельности',
  instrumental: 'Договором об участии в хозяйственной деятельности',
}

function offerForms(program: string) {
  const p = program ? ` «${program}»` : ''
  return {
    dative: `Соглашению об участии в целевой потребительской программе${p}`,
    genitive: `Соглашения об участии в целевой потребительской программе${p}`,
    instrumental: `Соглашением об участии в целевой потребительской программе${p}`,
  }
}

/** Дата из значения цепи («2027-04-07T00:00:00») или ISO — в виде ДД.ММ.ГГГГ. */
export function formatDateRu(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!m) return String(value)
  return `${m[3]}.${m[2]}.${m[1]}`
}

/** Номер договора займа — короткая форма хэша займа, как в цепи (8 знаков). */
export function loanContractNumber(factory: DocFactory<any>, debt_hash: string): string {
  return factory.getShortHash(debt_hash, 8)
}

/** Сумма документа: цифрами с символом валюты из самого актива. */
export function amountFields(amount: string) {
  return { amount_digits: amountWithSymbolRu(amount) }
}

/**
 * Основание договора займа. Для договора об участии номер и дата берутся из
 * сведений пайщика по программе «Благорост» (как у приложений к договору);
 * для оферты — из сведений о соглашении программы.
 */
export async function resolveLoanBasis(
  storage: any,
  data: { coopname: string, username: string, basis_type: 'uhd' | 'offer', program_name?: string, block_num?: number },
): Promise<LoanBasis> {
  const udata = new Udata(storage)
  const keys = data.basis_type === 'uhd'
    ? [Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER, Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT]
    : [Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER, Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_CREATED_AT]
  const [number, createdAt] = await Promise.all(keys.map(key => udata.getOne({
    coopname: data.coopname,
    username: data.username,
    key,
    block_num: data.block_num,
  })))
  if (!number?.value || !createdAt?.value) {
    throw new Error(data.basis_type === 'uhd'
      ? 'Договор об участии в хозяйственной деятельности пайщика не найден — заём без основания не оформляется'
      : 'Соглашение об участии в программе не найдено — заём без основания не оформляется')
  }
  const forms = data.basis_type === 'uhd' ? UHD_FORMS : offerForms(data.program_name ?? '')
  return {
    basis_title_dative: forms.dative,
    basis_title_genitive: forms.genitive,
    basis_title_instrumental: forms.instrumental,
    basis_number: String(number.value),
    basis_date: String(createdAt.value),
  }
}

/**
 * Обеспечение словами для заявления и протокола: запись реестра обеспечения
 * по ключу либо имущество на ответственном хранении по приложению (Генерация).
 */
export function collateralText(
  data: { collateral?: string, storage_appendix_number?: string },
  basis: LoanBasis,
): string {
  if (data.collateral) {
    const entry = Debt.findCollateral(data.collateral)
    if (!entry) throw new Error(`Обеспечение «${data.collateral}» в реестре обеспечения не найдено`)
    return entry.human_name
  }
  if (data.storage_appendix_number) {
    return `имущество, находящееся на ответственном хранении согласно Приложению № ${data.storage_appendix_number} к ${basis.basis_title_dative} № ${basis.basis_number} от ${basis.basis_date}`
  }
  throw new Error('Не указано обеспечение займа: ключ реестра обеспечения или номер приложения об ответственном хранении')
}

/**
 * Обеспечение в заявлении пайщика. У обеспечения паевым взносом заявление
 * называет его размер — он равен сумме займа; имущество на ответственном
 * хранении описано приложением, размер там не пишется.
 */
export function statementCollateralText(
  data: { collateral?: string, storage_appendix_number?: string, amount: string },
  basis: LoanBasis,
): string {
  const text = collateralText(data, basis)
  return data.collateral ? `${text} в размере ${amountWithSymbolRu(data.amount)}` : text
}

/** Реквизиты в заявлении: название каждого реквизита жирным, значения как есть. */
export function emphasizePaymentDetails(details: string): string {
  return details
    .split('\n')
    .map(line => line.replace(/^([^:<]+):/, '<b>$1:</b>'))
    .join('\n')
}

/** Программа в дательном падеже для договора под паевой взнос: «целевой потребительской программе «Благорост»». */
export function collateralProgramDative(collateral: string): string {
  const entry = Debt.findCollateral(collateral)
  if (!entry) throw new Error(`Обеспечение «${collateral}» в реестре обеспечения не найдено`)
  // Наименование в реестре: «имущественное право на возврат части паевого взноса по целевой потребительской программе «…»».
  const m = /по (целевой потребительской программе .*)$/u.exec(entry.human_name)
  return m ? m[1] : entry.human_name
}

/**
 * Данные стороны в преамбуле договора займа и договора залога: у физического
 * лица — паспорт и адрес, у ИП — ОГРНИП, у организации — ОГРН. Без паспорта
 * договор физическому лицу не собирается: пайщик вносит его перед заявлением.
 */
export function partyIdentity(user: InternalGetUserResult): string {
  switch (user.type) {
    case 'individual': {
      const d = user.data as ExternalIndividualData
      const p = d.passport
      if (!p || !p.series || !p.number) throw new Error('Для документов займа нужны паспортные данные пайщика')
      return `, паспорт: серия ${p.series}, № ${p.number}, выданный ${p.issued_by} ${formatDateRu(p.issued_at)}, проживающий по адресу: ${d.full_address}`
    }
    case 'entrepreneur': {
      const d = user.data as ExternalEntrepreneurData
      return `, ОГРНИП ${d.details.ogrn}, ИНН ${d.details.inn}, адрес: ${d.full_address}`
    }
    case 'organization': {
      const d = user.data as ExternalOrganizationData
      return `, ОГРН ${d.details.ogrn}, ИНН ${d.details.inn}, адрес: ${d.full_address}`
    }
    default:
      throw new Error(`Неизвестный тип пайщика: ${user.type}`)
  }
}

/** Реквизиты залогодателя в разделе «Адреса и реквизиты сторон» договора залога, по строке на реквизит. */
export function pledgerRequisites(user: InternalGetUserResult): string {
  switch (user.type) {
    case 'individual': {
      const d = user.data as ExternalIndividualData
      const p = d.passport
      if (!p || !p.series || !p.number) throw new Error('Для документов займа нужны паспортные данные пайщика')
      return [`Регистрация: ${d.full_address}`, `Паспорт серия: ${p.series}`, `Номер: ${p.number}`, `Выдан: ${formatDateRu(p.issued_at)}`, `Кем: ${p.issued_by}`, `Телефон: ${d.phone}`].join('\n')
    }
    case 'entrepreneur': {
      const d = user.data as ExternalEntrepreneurData
      return [`Регистрация: ${d.full_address}`, `ОГРНИП: ${d.details.ogrn}`, `ИНН: ${d.details.inn}`, `Телефон: ${d.phone}`].join('\n')
    }
    case 'organization': {
      const d = user.data as ExternalOrganizationData
      return [`Юр. адрес: ${d.full_address}`, `ОГРН: ${d.details.ogrn}`, `ИНН: ${d.details.inn}`, `КПП: ${d.details.kpp}`, `Телефон: ${d.phone}`].join('\n')
    }
    default:
      throw new Error(`Неизвестный тип пайщика: ${user.type}`)
  }
}
