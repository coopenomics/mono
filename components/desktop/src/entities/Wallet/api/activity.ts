import { Queries } from '@coopenomics/sdk';
import { client } from '../../../shared/api/client';

export type IGetMyWalletMovementsInput = Queries.Wallet.GetMyWalletMovements.IInput['data'];
export type IWalletMovementsPage = Queries.Wallet.GetMyWalletMovements.IOutput[typeof Queries.Wallet.GetMyWalletMovements.name];
export type IWalletMovement = IWalletMovementsPage['items'][number];

export type IGetMyPendingPayoutsInput = Queries.Wallet.GetMyPendingPayouts.IInput['data'];
export type IWalletPendingItem = Queries.Wallet.GetMyPendingPayouts.IOutput[typeof Queries.Wallet.GetMyPendingPayouts.name][number];

/** Движения по кошелькам пайщика, свежие сверху; отбор по одному кошельку. */
export async function loadMyWalletMovements(data: IGetMyWalletMovementsInput): Promise<IWalletMovementsPage> {
  const { [Queries.Wallet.GetMyWalletMovements.name]: result } = await client.Query(Queries.Wallet.GetMyWalletMovements.query, {
    variables: { data },
  });
  return result;
}

/** Что у пайщика в работе: заявки до решения совета, выплаты у кассира, неоплаченные пополнения. */
export async function loadMyPendingPayouts(data: IGetMyPendingPayoutsInput): Promise<IWalletPendingItem[]> {
  const { [Queries.Wallet.GetMyPendingPayouts.name]: result } = await client.Query(Queries.Wallet.GetMyPendingPayouts.query, {
    variables: { data },
  });
  return result;
}
