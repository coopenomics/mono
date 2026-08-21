import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { ILearnerInput, IQuoteInput, IUpdateLearnerInput } from '../model';

export async function fetchMyLearners() {
  const { [Queries.Edubridge.MyLearners.name]: result } = await client.Query(Queries.Edubridge.MyLearners.query);
  return result;
}

export async function fetchMyEnrollments() {
  const { [Queries.Edubridge.MyEnrollments.name]: result } = await client.Query(Queries.Edubridge.MyEnrollments.query);
  return result;
}

export async function fetchQuote(data: IQuoteInput) {
  const { [Queries.Edubridge.Quote.name]: result } = await client.Query(Queries.Edubridge.Quote.query, { variables: { data } });
  return result;
}

export async function addLearner(data: ILearnerInput) {
  const { [Mutations.Edubridge.AddLearner.name]: result } = await client.Mutation(Mutations.Edubridge.AddLearner.mutation, {
    variables: { data },
  });
  return result;
}

export async function updateLearner(data: IUpdateLearnerInput) {
  const { [Mutations.Edubridge.UpdateLearner.name]: result } = await client.Mutation(Mutations.Edubridge.UpdateLearner.mutation, {
    variables: { data },
  });
  return result;
}

export async function removeLearner(id: string) {
  const { [Mutations.Edubridge.RemoveLearner.name]: result } = await client.Mutation(Mutations.Edubridge.RemoveLearner.mutation, {
    variables: { id },
  });
  return result;
}
