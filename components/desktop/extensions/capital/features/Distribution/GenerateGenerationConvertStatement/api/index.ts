import type {
  IGenerateDocumentOptionsInput,
  IGeneratedDocumentOutput,
} from 'src/shared/lib/types/document';
import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

async function generateGenerationConvertStatement(
  data: Mutations.Capital.GenerateGenerationConvertStatement.IInput['data'],
  options?: IGenerateDocumentOptionsInput,
): Promise<IGeneratedDocumentOutput> {
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
  generateGenerationConvertStatement,
};
