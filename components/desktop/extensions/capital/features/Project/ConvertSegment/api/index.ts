import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

export type IConvertSegmentInput =
  Mutations.Capital.ConvertSegment.IInput['data'];
export type IConvertSegmentOutput =
  Mutations.Capital.ConvertSegment.IOutput[typeof Mutations.Capital.ConvertSegment.name];

export type IGenerateConvertStatementInput =
  Mutations.Capital.GenerateGenerationConvertStatement.IInput;
export type IGenerateConvertStatementOutput =
  Mutations.Capital.GenerateGenerationConvertStatement.IOutput[typeof Mutations.Capital.GenerateGenerationConvertStatement.name];


async function convertSegment(
  data: IConvertSegmentInput,
): Promise<IConvertSegmentOutput> {
  const { [Mutations.Capital.ConvertSegment.name]: result } =
    await client.Mutation(Mutations.Capital.ConvertSegment.mutation, {
      variables: {
        data,
      },
    });

  return result;
}

async function generateConvertStatement(
  data: IGenerateConvertStatementInput['data'],
  options?: IGenerateConvertStatementInput['options'],
): Promise<IGenerateConvertStatementOutput> {
  const { [Mutations.Capital.GenerateGenerationConvertStatement.name]: result } =
    await client.Mutation(Mutations.Capital.GenerateGenerationConvertStatement.mutation, {
      variables: {
        data,
        options,
      },
    });

  return result;
}


export const api = {
  convertSegment,
  generateConvertStatement,
};
