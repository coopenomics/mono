import type { ICreateDebtOutput, ICreateDebtInput } from 'app/extensions/capital/entities/Debt/model';
import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

const lang = { lang: 'ru' };

async function createDebt(data: ICreateDebtInput): Promise<ICreateDebtOutput> {
  const { [Mutations.Capital.CreateDebt.name]: result } = await client.Mutation(Mutations.Capital.CreateDebt.mutation, {
    variables: { data },
  });
  return result;
}

async function generateStatement(data: Mutations.Capital.GenerateGetLoanStatement.IInput['data']) {
  const { [Mutations.Capital.GenerateGetLoanStatement.name]: result } = await client.Mutation(
    Mutations.Capital.GenerateGetLoanStatement.mutation,
    { variables: { data, options: lang } },
  );
  return result;
}

async function generateContract(data: Mutations.Capital.GenerateLoanContract.IInput['data']) {
  const { [Mutations.Capital.GenerateLoanContract.name]: result } = await client.Mutation(
    Mutations.Capital.GenerateLoanContract.mutation,
    { variables: { data, options: lang } },
  );
  return result;
}

async function refreshSegment(data: Mutations.Capital.RefreshSegment.IInput['data']) {
  return client.Mutation(Mutations.Capital.RefreshSegment.mutation, { variables: { data } });
}

export const api = {
  createDebt,
  generateStatement,
  generateContract,
  refreshSegment,
};
