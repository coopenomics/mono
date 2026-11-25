import type { IGenerationOptions } from '@coopenomics/docs-templates';
import type { IGenerate, IGeneratedDocument } from '../model';

import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

async function generateDocument(data: IGenerate, options?: IGenerationOptions): Promise<IGeneratedDocument> {
  const { [Mutations.Documents.GenerateDocument.name]: result } = await client.Mutation(
    Mutations.Documents.GenerateDocument.mutation,
    {
      variables: {
        input: {
          data,
          options,
        },
      },
    }
  );

  return result;
}

export const api = {
  generateDocument,
};
