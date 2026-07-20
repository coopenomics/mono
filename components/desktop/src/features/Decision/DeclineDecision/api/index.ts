import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type { IDeclineDecisionInput } from '../model';

/**
 * Отклонение решения совета по отрицательному консенсусу через GraphQL-мутацию
 * `declineDecision`. Действие проводит контроллер ключом кооператива
 * (контракт `soviet::declinedec` проверяет большинство голосов «против»).
 */
async function declineDecision(data: IDeclineDecisionInput) {
  const { [Mutations.Decisions.DeclineDecision.name]: result } = await client.Mutation(
    Mutations.Decisions.DeclineDecision.mutation,
    { variables: { data } }
  );
  return result;
}

export const api = {
  declineDecision,
};
