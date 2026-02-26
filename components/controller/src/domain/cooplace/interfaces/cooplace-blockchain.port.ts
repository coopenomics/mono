import { MarketContract } from 'cooptypes';
import type { Interfaces } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';

export interface CooplaceBlockchainPort {
  // Основной flow (OFFER→ORDER)
  acceptRequest(data: MarketContract.Actions.AcceptRequest.IAcceptRequest): Promise<TransactResult>;
  cancelRequest(data: MarketContract.Actions.CancelRequest.ICancelRequest): Promise<TransactResult>;
  completeRequest(data: MarketContract.Actions.CompleteRequest.ICompleteRequest): Promise<TransactResult>;
  confirmOnReceive(data: MarketContract.Actions.ConfirmReceive.IConfirmReceive): Promise<TransactResult>;
  confirmOnSupply(data: MarketContract.Actions.ConfirmSupply.IConfirmSupply): Promise<TransactResult>;
  createChildOrder(data: MarketContract.Actions.CreateOrder.ICreateOrder): Promise<TransactResult>;
  createParentOffer(data: MarketContract.Actions.CreateOffer.ICreateOffer): Promise<TransactResult>;
  declineRequest(data: MarketContract.Actions.DeclineRequest.IDeclineRequest): Promise<TransactResult>;
  deliverOnRequest(data: MarketContract.Actions.DeliverOnRequest.IDeliverOnRequest): Promise<TransactResult>;
  openDispute(data: MarketContract.Actions.OpenDispute.IOpenDispute): Promise<TransactResult>;
  receiveOnRequest(data: MarketContract.Actions.ReceiveOnRequest.IReceiveOnRequest): Promise<TransactResult>;
  supplyOnRequest(data: MarketContract.Actions.SupplyOnRequest.ISupplyOnRequest): Promise<TransactResult>;

  // Новые actions (строго типизированы через Interfaces.Marketplace)
  reqReturn(data: Interfaces.Marketplace.IReqreturn): Promise<TransactResult>;
  coopstock(data: Interfaces.Marketplace.ICoopstock): Promise<TransactResult>;
  acceptStock(data: Interfaces.Marketplace.IAcceptstock): Promise<TransactResult>;
  destroy(data: Interfaces.Marketplace.IDestroy): Promise<TransactResult>;
  reoffer(data: Interfaces.Marketplace.IReoffer): Promise<TransactResult>;

  // Перевозки
  createShipment(data: Interfaces.Marketplace.ICreateship): Promise<TransactResult>;
  signByDriver(data: Interfaces.Marketplace.ISignbydriver): Promise<TransactResult>;
  arrived(data: Interfaces.Marketplace.IArrived): Promise<TransactResult>;
  receiveShipment(data: Interfaces.Marketplace.IReceiveshipm): Promise<TransactResult>;

  // ORDER→OFFER direction
  createOrder(data: Interfaces.Marketplace.ICreateorder): Promise<TransactResult>;
  respondOffer(data: Interfaces.Marketplace.IRespondoffer): Promise<TransactResult>;
}

export const COOPLACE_BLOCKCHAIN_PORT = Symbol('CooplaceBlockchainPort');
