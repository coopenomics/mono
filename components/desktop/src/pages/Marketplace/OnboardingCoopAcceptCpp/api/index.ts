import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Эпик 1 / Эпик 12: L1-онбординг кооператива на ЦПП «Стол заказов».
 *
 * Marketplace подключён к ПЛАТФОРМЕННОМУ механизму онбординга (как capital):
 *  - состояние читается через `getExtensionOnboardingState(extension_name:'market')`;
 *  - шаг (утверждение документа Советом) отправляется через
 *    `completeExtensionOnboardingStep` — backend создаёт проект решения совета,
 *    публикует его и регистрирует tracking-rule; по реальному ончейн-принятию
 *    решения состояние шага становится done автоматически.
 *  - HTML каждого документа рендерится через `generateDocument` (registry_id).
 */

export const MARKETPLACE_EXTENSION_NAME = 'market';

export type MarketplaceOnboardingState =
  Queries.Onboarding.GetExtensionOnboardingState.IOutput['getExtensionOnboardingState'];

export async function fetchOnboardingState(): Promise<MarketplaceOnboardingState> {
  const { [Queries.Onboarding.GetExtensionOnboardingState.name]: result } =
    await client.Query(Queries.Onboarding.GetExtensionOnboardingState.query, {
      variables: { extension_name: MARKETPLACE_EXTENSION_NAME },
    });
  return result;
}

export type CompleteStepData =
  Mutations.Onboarding.CompleteExtensionOnboardingStep.IInput['data'];

export async function completeStep(
  data: CompleteStepData,
): Promise<MarketplaceOnboardingState> {
  const { [Mutations.Onboarding.CompleteExtensionOnboardingStep.name]: result } =
    await client.Mutation(
      Mutations.Onboarding.CompleteExtensionOnboardingStep.mutation,
      { variables: { data } },
    );
  return result;
}

export interface GeneratedDocument {
  hash: string;
  html: string;
  full_title: string;
}

export async function generateDocument(
  coopname: string,
  username: string,
  registry_id: number,
): Promise<GeneratedDocument> {
  const input: Mutations.Documents.GenerateDocument.IInput = {
    input: { data: { coopname, username, registry_id } },
  };
  const { [Mutations.Documents.GenerateDocument.name]: result } =
    await client.Mutation(Mutations.Documents.GenerateDocument.mutation, {
      variables: input,
    });
  return {
    hash: result?.hash || '',
    html: result?.html || '',
    full_title: result?.full_title || '',
  };
}
