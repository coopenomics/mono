import { reportsFundSelector } from '../../selectors/reports/fundSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'reportsEditFund'

/**
 * Председатель совета меняет описание и процент отчислений фонда. Правила
 * (процент в пределах, сумма процентов фондов накопления не выше 100 %)
 * проверяет сервер до обращения в цепь.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'ReportsEditFundInput!') }, reportsFundSelector],
})

export interface IInput {
  input: ModelTypes['ReportsEditFundInput']
}

export interface IOutput {
  [name]: ModelTypes['ReportsFund']
}
