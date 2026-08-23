import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';

export type IGenerateMembershipExitDecisionData =
  Mutations.MembershipExit.GenerateMembershipExitDecision.IInput['data'];
export type IGenerateMembershipExitDecisionResult =
  Mutations.MembershipExit.GenerateMembershipExitDecision.IOutput[typeof Mutations.MembershipExit.GenerateMembershipExitDecision.name];

/**
 * Композабл генерации документа решения собрания совета о выходе пайщика (registry 201).
 */
export function useGenerateMembershipExitDecision() {
  const { info } = useSystemStore();

  async function generateMembershipExitDecision(
    data: Omit<IGenerateMembershipExitDecisionData, 'coopname'>,
  ): Promise<IGenerateMembershipExitDecisionResult> {
    const {
      [Mutations.MembershipExit.GenerateMembershipExitDecision.name]: result,
    } = await client.Mutation(
      Mutations.MembershipExit.GenerateMembershipExitDecision.mutation,
      {
        variables: {
          data: {
            coopname: info.coopname,
            ...data,
          },
          options: {
            lang: 'ru',
          },
        },
      },
    );

    return result;
  }

  return {
    generateMembershipExitDecision,
  };
}
