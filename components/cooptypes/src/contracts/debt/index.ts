import * as contractNames from '../../common/names'

export * as Actions from './actions'
export * as Tables from './tables'

/**
 * @private
 */
export * as Interfaces from '../../interfaces/debt'

export const contractName = contractNames._debt

/**
 * Состояния займа в таблице `debts`.
 */
export enum Status {
  CREATED = 'created',
  AUTHORIZED = 'authorized',
  SIGNED = 'signed',
  PAYING = 'paying',
  ISSUED = 'issued',
  OVERDUE = 'overdue',
}
