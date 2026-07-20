import { client } from 'src/shared/api/client';

import { Queries, Mutations } from '@coopenomics/sdk';
import type { IAccount, IAccounts, IGetAccounts } from '../types';

async function getAccount(username: string): Promise<IAccount | undefined> {
  const { [Queries.Accounts.GetAccount.name]: output } = await client.Query(Queries.Accounts.GetAccount.query, {
    variables: {
      data: {username}
    }
  });

  return output;
}

async function getAccounts(variables?: IGetAccounts): Promise<IAccounts> {
  const { [Queries.Accounts.GetAccounts.name]: output } = await client.Query(Queries.Accounts.GetAccounts.query, {
    variables
  });

  return output;
}

async function deleteAccount(username: string): Promise<boolean> {
  const { [Mutations.Accounts.DeleteAccount.name]: output } = await client.Mutation(
    Mutations.Accounts.DeleteAccount.mutation,
    {
      variables: {
        data: { username_for_delete: username },
      },
    },
  );

  return output;
}

export const api ={
  getAccount,
  getAccounts,
  deleteAccount
}
