import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type {
  IContributor,
  IContributorsPagination,
  IGetContributorInput,
  IGetContributorsInput,
} from '../model';

async function loadContributors(
  data: IGetContributorsInput,
): Promise<IContributorsPagination> {

  const { [Queries.Capital.GetContributors.name]: output } = await client.Query(
    Queries.Capital.GetContributors.query,
    {
      variables: data,
    },
  );
  return output;
}

// Запрос одного участника может не найти его — отсюда `| null`.
// Вызывающие это уже предполагают (ProjectsFilterPanel пишет `?? null`).
async function loadContributor(
  data: IGetContributorInput,
): Promise<IContributor | null> {
  const { [Queries.Capital.GetContributor.name]: output } = await client.Query(
    Queries.Capital.GetContributor.query,
    {
      variables: {
        data,
      },
    },
  );
  return output ?? null;
}

export const api = {
  loadContributors,
  loadContributor,
};
