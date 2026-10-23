import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { IGeneratedDocumentOutput } from 'src/shared/lib/types/document';
import { SHARE_TRANSFER_ROLE } from '../model/types';
import type {
  IAccessRole,
  IGenerateShareTransferStatementInput,
  IRoleAssignmentInput,
  IGetShareTransferStateInput,
  IGetShareTransfersInput,
  IShareTransferState,
  IShareTransfersPagination,
  ITransferShareInput,
} from '../model/types';

async function loadState(data: IGetShareTransferStateInput): Promise<IShareTransferState> {
  const { [Queries.Capital.GetShareTransferState.name]: output } = await client.Query(
    Queries.Capital.GetShareTransferState.query,
    { variables: { data } },
  );
  return output;
}

async function loadTransfers(input: IGetShareTransfersInput): Promise<IShareTransfersPagination> {
  const { [Queries.Capital.GetShareTransfers.name]: output } = await client.Query(
    Queries.Capital.GetShareTransfers.query,
    { variables: input },
  );
  return output;
}

/** Заявление о трансляции паевого взноса (1090) без подписи — на сумму, которую назвал пайщик. */
async function generateStatement(data: IGenerateShareTransferStatementInput): Promise<IGeneratedDocumentOutput> {
  const { [Mutations.Capital.GenerateCapitalizationToMainWalletConvertStatement.name]: output } = await client.Mutation(
    Mutations.Capital.GenerateCapitalizationToMainWalletConvertStatement.mutation,
    { variables: { data } },
  );
  return output;
}

async function transferShare(data: ITransferShareInput): Promise<IShareTransferState> {
  const { [Mutations.Capital.TransferShare.name]: output } = await client.Mutation(
    Mutations.Capital.TransferShare.mutation,
    { variables: { data } },
  );
  return output;
}

/**
 * Роль доступа к странице трансляции с её держателями. Назначения ведёт ядро
 * (страница управления доступом председателя); здесь те же операции.
 */
async function loadAccessRole(): Promise<IAccessRole | null> {
  const { [Queries.AccessRoles.GetAssignableRoles.name]: roles } = await client.Query(
    Queries.AccessRoles.GetAssignableRoles.query,
  );
  return roles.find((role) => role.key === SHARE_TRANSFER_ROLE) ?? null;
}

async function grantAccess(data: IRoleAssignmentInput): Promise<IAccessRole> {
  const { [Mutations.AccessRoles.AssignRole.name]: output } = await client.Mutation(
    Mutations.AccessRoles.AssignRole.mutation,
    { variables: { data } },
  );
  return output;
}

async function revokeAccess(data: IRoleAssignmentInput): Promise<IAccessRole> {
  const { [Mutations.AccessRoles.RevokeRole.name]: output } = await client.Mutation(
    Mutations.AccessRoles.RevokeRole.mutation,
    { variables: { data } },
  );
  return output;
}

export const api = { loadState, loadTransfers, generateStatement, transferShare, loadAccessRole, grantAccess, revokeAccess };
