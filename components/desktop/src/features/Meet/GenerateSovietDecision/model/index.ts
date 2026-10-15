import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model'
import { t } from 'src/shared/i18n';

export type IGenerateSovietDecisionInput = Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument.IInput['data'];
export type IGenerateSovietDecisionResult = Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument.IOutput[typeof Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument.name];

export async function generateSovietDecision(data: IGenerateSovietDecisionInput, options?: any): Promise<IGenerateSovietDecisionResult> {
  const { [Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument.name]: generatedDocument } = await client.Mutation(
    Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument.mutation,
    {
      variables: {
        data,
        options
      }
    }
  );

  return generatedDocument;
}

export function useGenerateSovietDecisionOnAnnualMeet() {
  const { info } = useSystemStore()

  /**
   * Генерирует документ для решения о проведении общего собрания
   */
  async function generateSovietDecisionOnAnnualMeet(
    data: Omit<IGenerateSovietDecisionInput, 'coopname'>
  ): Promise<IGenerateSovietDecisionResult> {
    // Здесь необходимо убедиться, что переданы все обязательные параметры согласно DTO
    if (!data.decision_id) {
      throw new Error(t('meet.error.decisionIdRequired'))
    }

    if (!data.meet_hash) {
      throw new Error(t('meet.error.hashRequired'))
    }

    const { [Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument.name]: result } = await client.Mutation(
      Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument.mutation,
      {
        variables: {
          data: {
            coopname: info.coopname,
            ...data
          }
        }
      }
    )

    return result
  }

  return {
    generateSovietDecisionOnAnnualMeet
  }
}
