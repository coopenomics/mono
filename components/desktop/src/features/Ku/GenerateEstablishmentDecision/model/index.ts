import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';

export type IGenerateEstablishmentDecisionData = Mutations.Ku.GenerateEstablishmentDecision.IInput['data'];
export type IGenerateEstablishmentDecisionResult =
  Mutations.Ku.GenerateEstablishmentDecision.IOutput[typeof Mutations.Ku.GenerateEstablishmentDecision.name];

export function useGenerateEstablishmentDecision() {
  const { info } = useSystemStore();

  /** Генерирует решение совета об учреждении кооперативного участка */
  async function generateEstablishmentDecision(
    data: Omit<IGenerateEstablishmentDecisionData, 'coopname'>,
  ): Promise<IGenerateEstablishmentDecisionResult> {
    const { [Mutations.Ku.GenerateEstablishmentDecision.name]: result } = await client.Mutation(
      Mutations.Ku.GenerateEstablishmentDecision.mutation,
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
    generateEstablishmentDecision,
  };
}
