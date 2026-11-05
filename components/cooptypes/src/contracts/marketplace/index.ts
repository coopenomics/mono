import * as contractNames from '../../common/names'

export * as Actions from './actions'
export * as Tables from './tables'

/**
 * Эталон расчёта итога месяца участка и списания по ставкам — для тестов и
 * показа; источник истины — контракт.
 */
export * as PeriodModel from './periodModel'

/**
 * @private
 */
export * as Interfaces from '../../interfaces/marketplace'

export const contractName = contractNames._marketplace
