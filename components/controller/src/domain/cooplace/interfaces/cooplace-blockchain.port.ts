import { MarketContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';

type DocumentInput = any;

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
  reqReturn(data: { coopname: string; username: string; request_hash: string; return_statement: DocumentInput }): Promise<TransactResult>;
  coopstock(data: { coopname: string; braname: string; hash: string; units: number; unit_cost: string; product_lifecycle_secs: number; warranty_period_secs: number; membership_fee_amount: string; meta: string }): Promise<TransactResult>;
  acceptStock(data: { coopname: string; username: string; request_hash: string; convert_in: DocumentInput; return_statement: DocumentInput }): Promise<TransactResult>;
  destroy(data: { coopname: string; request_hash: string; destruction_act: DocumentInput }): Promise<TransactResult>;
  reoffer(data: { coopname: string; request_hash: string; new_hash: string; new_unit_cost: string; new_meta: string }): Promise<TransactResult>;
}

export const COOPLACE_BLOCKCHAIN_PORT = Symbol('CooplaceBlockchainPort');
