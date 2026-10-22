import type { Mutations, Queries } from '@coopenomics/sdk';

export type IShareTransferState =
  Queries.Capital.GetShareTransferState.IOutput[typeof Queries.Capital.GetShareTransferState.name];
export type IGetShareTransferStateInput = Queries.Capital.GetShareTransferState.IInput['data'];

export type IShareTransfersPagination =
  Queries.Capital.GetShareTransfers.IOutput[typeof Queries.Capital.GetShareTransfers.name];
export type IShareTransfer = IShareTransfersPagination['items'][number];
export type IGetShareTransfersInput = Queries.Capital.GetShareTransfers.IInput;

export type ITransferShareInput = Mutations.Capital.TransferShare.IInput['data'];
export type IGenerateShareTransferStatementInput =
  Mutations.Capital.GenerateCapitalizationToMainWalletConvertStatement.IInput['data'];

/** Роль доступа к странице трансляции — объявлена Благоростом, назначает председатель. */
export const SHARE_TRANSFER_ROLE = 'blagorost-transfer';

export type IAccessRole =
  Queries.AccessRoles.GetAssignableRoles.IOutput[typeof Queries.AccessRoles.GetAssignableRoles.name][number];
export type IAccessRoleHolder = IAccessRole['assignments'][number];
export type IRoleAssignmentInput = Mutations.AccessRoles.AssignRole.IInput['data'];
