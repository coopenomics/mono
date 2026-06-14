import { criticalActionAuditEntrySelector } from '../../selectors/criticalActions/criticalActionAuditEntrySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getCriticalActionAuditTrail'

/**
 * Audit-trail критических действий, затрагивающих пайщика (для контролирующего органа).
 */
export const query = Selector('Query')({
  [name]: [{ target_id: $('target_id', 'String!') }, criticalActionAuditEntrySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  target_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
