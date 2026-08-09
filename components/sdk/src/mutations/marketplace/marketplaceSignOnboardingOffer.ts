import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/**
 * Эпик 1 фоллоуап — L3 sign-mutation для ЦПП «Стол заказов».
 *
 * Пайщик подписывает оферту прямо со стола (страница `OnboardingMemberPickCpp`)
 * после gate'а Story 1.4. Backend пишет on-chain `wallet::signagree` с
 * `program_id=2`, возвращает свежее состояние онбординга (без второго запроса
 * на `marketplaceOnboardingState`).
 *
 * Подписанный document — результат `Mutations.Documents.GenerateDocument`
 * (registry_id=1101) + `LocalWallet.signDocument` на фронте.
 */
export const name = 'marketplaceSignOnboardingOffer'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceSignOnboardingOfferInput!') },
    {
      requires_gate: true,
      template_registry_id: true,
      agreement_id: true,
      completed_at: true,
      source: true,
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceSignOnboardingOfferInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
