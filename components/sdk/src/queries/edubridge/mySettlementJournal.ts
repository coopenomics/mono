import { eduSettlementEntrySelector } from '../../selectors/edubridge/teacherSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMySettlementJournal'

/** Моя выписка: зачисления по принятым результатам и возвраты паевого взноса с их состоянием */
export const query = Selector('Query')({
  [name]: eduSettlementEntrySelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
