import { fetchTable } from '../../../shared/api';
import { client } from '../../../shared/api/client';
import { Queries } from '@coopenomics/sdk';

import {
  LimitsList,
  SecondaryIndexesNumbers,
} from 'src/shared/config';

import {
  IDepositData,
  IWithdrawData,
  IProgramWalletData,
  ICoopProgramSummary,
  ExtendedProgramWalletData,
  IGetPaymentMethods,
  IPaymentMethodData,
  IUserAgreement,
} from '../model';

import {
  ILoadSingleUserDeposit,
  ILoadSingleUserWithdraw,
  ILoadUserDeposits,
  ILoadUserProgramWallets,
  ILoadUserWithdraws,
} from '../model';
import { GatewayContract, Ledger2 } from 'cooptypes';

async function loadSingleUserDepositData(
  params: ILoadSingleUserDeposit
): Promise<IDepositData> {
  return (
    await fetchTable(
      GatewayContract.contractName.production,
      params.coopname,
      GatewayContract.Tables.Incomes.tableName,
      params.username,
      params.username,
      LimitsList.One
    )
  )[0] as IDepositData;
}

async function loadSingleUserWithdrawData(
  params: ILoadSingleUserWithdraw
): Promise<IWithdrawData> {
  return (
    await fetchTable(
      GatewayContract.contractName.production,
      params.coopname,
      GatewayContract.Tables.Outcomes.tableName,
      params.withdraw_id,
      params.withdraw_id,
      LimitsList.One
    )
  )[0] as IWithdrawData;
}

async function loadUserDepositsData(
  params: ILoadUserDeposits
): Promise<IDepositData[]> {
  return (await fetchTable(
    GatewayContract.contractName.production,
    params.coopname,
    GatewayContract.Tables.Incomes.tableName,
    params.username,
    params.username,
    LimitsList.None,
    SecondaryIndexesNumbers.Two
  )) as IDepositData[];
}

async function loadUserWithdrawsData(
  params: ILoadUserWithdraws
): Promise<IWithdrawData[]> {
  return (await fetchTable(
    GatewayContract.contractName.production,
    params.coopname,
    GatewayContract.Tables.Outcomes.tableName,
    params.username,
    params.username,
    LimitsList.None,
    SecondaryIndexesNumbers.Two
  )) as IWithdrawData[];
}

/**
 * После Эпика 3 источник кошельков — `getProgramWallets` (контроллер собирает
 * программные срезы из `ledger2::userwallets` через `wallet::users.programs[]`).
 * Метаданные программ кооператива (`soviet::programs`) идут через GraphQL
 * `cooperativePrograms` (ADR: фронт не ходит в чейн напрямую). Заголовок
 * программы для UI — из реестра `cooptypes/src/ledger2/programs.ts`.
 */
async function loadUserProgramWalletsData(
  params: ILoadUserProgramWallets
): Promise<ExtendedProgramWalletData[]> {
  const [programsResponse, walletsResponse] = await Promise.all([
    client.Query(Queries.Agreements.CooperativePrograms.query, {
      variables: { coopname: params.coopname },
    }),
    client.Query(Queries.Wallet.GetProgramWallets.query, {
      variables: {
        filter: { coopname: params.coopname, username: params.username },
        options: { page: 1, limit: 1000 },
      },
    }),
  ]);

  const programs = programsResponse[Queries.Agreements.CooperativePrograms.name] ?? [];
  const paginated = walletsResponse[Queries.Wallet.GetProgramWallets.name];

  return (paginated?.items ?? []).map((wallet) => {
    const programInfo = programs.find((program) => String(program.id) === String(wallet.program_id));
    // title — UI-метка из реестра (`ЦПП Генератор` и т.п.), не chain-title.
    const enrichedDetails: ICoopProgramSummary | undefined = programInfo
      ? {
          id: programInfo.id,
          title: Ledger2.getProgramLabel(Number(programInfo.id)),
          program_type: programInfo.program_type,
          is_active: programInfo.is_active,
          draft_id: programInfo.draft_id,
        }
      : undefined;
    return {
      ...(wallet as unknown as IProgramWalletData),
      program_type: wallet.program_type,
      ...(enrichedDetails ? { program_details: enrichedDetails } : {}),
    } as ExtendedProgramWalletData;
  });
}


async function loadMethods(params: IGetPaymentMethods): Promise<IPaymentMethodData[]> {
  const result = await client.Query(Queries.PaymentMethods.GetPaymentMethods.query, {
    variables: {
      data: {
        username: params.username, // Фильтруем по username
        limit: 100, // Получаем все методы
        page: 1,
      },
    },
  });

  // Маппинг данных SDK к ожидаемому формату
  const methods: IPaymentMethodData[] = (result).getPaymentMethods.items.map((item: any) => ({
    method_id: item.method_id,
    method_type: item.method_type,
    username: item.username,
    data: item.data,
    is_default: item.is_default,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));

  // Сортировка по method_id (от большего к меньшему)
  return methods.sort((a, b) => b.method_id.localeCompare(a.method_id));
}

/**
 * После Эпика 3 программные соглашения живут в `wallet::users.programs[]`,
 * непрограммные — в `soviet::agreements3`. Контроллер объединяет оба источника
 * в `getAgreements`, поэтому desktop читает только GraphQL.
 */
async function loadUserAgreements(coopname: string, username: string): Promise<IUserAgreement[]> {
  const { [Queries.Agreements.Agreements.name]: paginated } = await client.Query(
    Queries.Agreements.Agreements.query,
    {
      variables: {
        filter: { coopname, username },
        options: { page: 1, limit: 1000 },
      },
    }
  );
  return (paginated?.items ?? []) as IUserAgreement[];
}


export const api = {
  loadSingleUserDepositData,
  loadSingleUserWithdrawData,
  loadUserDepositsData,
  loadUserWithdrawsData,
  loadUserProgramWalletsData,
  loadMethods,
  loadUserAgreements
};
