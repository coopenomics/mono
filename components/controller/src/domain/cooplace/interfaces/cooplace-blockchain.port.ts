import { MarketContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';

export interface CooplaceBlockchainPort {
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
  moderateRequest(data: MarketContract.Actions.ModerateRequest.IModerateRequest): Promise<TransactResult>;
  prohibitRequest(data: MarketContract.Actions.ProhibitRequest.IProhibitRequest): Promise<TransactResult>;
  publishRequest(data: MarketContract.Actions.PublishRequest.IPublishRequest): Promise<TransactResult>;
  receiveOnRequest(data: MarketContract.Actions.ReceiveOnRequest.IReceiveOnRequest): Promise<TransactResult>;
  supplyOnRequest(data: MarketContract.Actions.SupplyOnRequest.ISupplyOnRequest): Promise<TransactResult>;
  unpublishRequest(data: MarketContract.Actions.UnpublishRequest.IUnpublishRequest): Promise<TransactResult>;
  updateRequest(data: MarketContract.Actions.UpdateRequest.IUpdateRequest): Promise<TransactResult>;
  
  // Новые actions
  requestReturn(data: MarketContract.Actions.RequestReturn.IRequestReturn): Promise<TransactResult>;
  coopstock(data: MarketContract.Actions.Coopstock.ICoopstock): Promise<TransactResult>;
  acceptStock(data: MarketContract.Actions.AcceptStock.IAcceptStock): Promise<TransactResult>;
  destroy(data: MarketContract.Actions.Destroy.IDestroy): Promise<TransactResult>;
  reoffer(data: MarketContract.Actions.Reoffer.IReoffer): Promise<TransactResult>;
}

export const COOPLACE_BLOCKCHAIN_PORT = Symbol('CooplaceBlockchainPort');
