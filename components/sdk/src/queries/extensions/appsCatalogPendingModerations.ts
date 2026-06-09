import { moderationRequestSelector } from '../../selectors/extensions/moderationRequestSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'appsCatalogPendingModerations'

/**
 * Список заявок на модерацию в apps-catalog (Story 9.9).
 * По умолчанию backend отдаёт SUBMITTED (ожидают решения оператора).
 */
export const query = Selector('Query')({
  [name]: [
    { status: $('status', 'ModerationStatusEnum') },
    moderationRequestSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  status?: ModelTypes['ModerationStatusEnum']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
