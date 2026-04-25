import { Cooperative, type MarketContract } from 'cooptypes';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { COOPLACE_BLOCKCHAIN_PORT, CooplaceBlockchainPort } from '~/domain/cooplace/interfaces/cooplace-blockchain.port';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import { Inject, Injectable } from '@nestjs/common';
import type { TransactResult } from '@wharfkit/session';
import type { AcceptChildOrderInputDomainInterface } from '~/domain/cooplace/interfaces/accept-child-order-input.interface';
import type { ConfirmReceiveOnRequestInputDomainInterface } from '~/domain/cooplace/interfaces/confirm-receive-on-request-input.interface';
import type { ConfirmSupplyOnRequestInputDomainInterface } from '~/domain/cooplace/interfaces/confirm-supply-on-request-input.interface';
import type { CreateChildOrderInputDomainInterface } from '~/domain/cooplace/interfaces/create-child-order-input.interface';
import type { ReceiveOnRequestInputDomainInterface } from '~/domain/cooplace/interfaces/receive-on-request-input.interface';
import type { SupplyOnRequestInputDomainInterface } from '~/domain/cooplace/interfaces/supply-on-request-input.interface';

import { config } from '~/config';
import type { ReqReturnInputDTO } from '../dto/req-return-input.dto';
import type { CoopstockInputDTO } from '../dto/coopstock-input.dto';
import type { AcceptStockInputDTO } from '../dto/accept-stock-input.dto';
import type { DestroyRequestInputDTO } from '../dto/destroy-request-input.dto';
import type { ReofferRequestInputDTO } from '../dto/reoffer-request-input.dto';

@Injectable()
export class CooplaceInteractor {
  private readonly config = config;

  constructor(
    private readonly documentDomainService: DocumentDomainService,
    @Inject(COOPLACE_BLOCKCHAIN_PORT) private readonly cooplaceBlockchainPort: CooplaceBlockchainPort
  ) {}

  async generateAssetContributionStatementDocument(
    data: Cooperative.Registry.AssetContributionStatement.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AssetContributionStatement.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateAssetContributionDecisionDocument(
    data: Cooperative.Registry.AssetContributionDecision.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AssetContributionDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateAssetContributionActDocument(
    data: Cooperative.Registry.AssetContributionAct.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AssetContributionAct.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateReturnByAssetStatementDocument(
    data: Cooperative.Registry.ReturnByAssetStatement.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.ReturnByAssetStatement.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateReturnByAssetDecisionDocument(
    data: Cooperative.Registry.ReturnByAssetDecision.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.ReturnByAssetDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateReturnByAssetActDocument(
    data: Cooperative.Registry.ReturnByAssetAct.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.ReturnByAssetAct.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  public async acceptChildOrder(data: AcceptChildOrderInputDomainInterface): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.acceptRequest({
      ...data,
      document: { ...data.document, meta: JSON.stringify(data.document.meta) },
    });
    return result;
  }

  public async cancelRequest(data: MarketContract.Actions.CancelRequest.ICancelRequest): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.cancelRequest(data);
    return result;
  }

  public async completeRequest(data: MarketContract.Actions.CompleteRequest.ICompleteRequest): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.completeRequest(data);
    return result;
  }

  public async confirmReceiveOnRequest(data: ConfirmReceiveOnRequestInputDomainInterface): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.confirmOnReceive({
      ...data,
      document: { ...data.document, meta: JSON.stringify(data.document.meta) },
    });
    return result;
  }

  public async confirmSupplyOnRequest(data: ConfirmSupplyOnRequestInputDomainInterface): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.confirmOnSupply({
      ...data,
      document: { ...data.document, meta: JSON.stringify(data.document.meta) },
    });
    return result;
  }

  public async createChildOrder(data: CreateChildOrderInputDomainInterface): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.createChildOrder({
      params: {
        ...data.params,
        document: { ...data.params.document, meta: JSON.stringify(data.params.document.meta) },
      },
    });
    return result;
  }

  public async createParentOffer(data: MarketContract.Actions.CreateOffer.ICreateOffer): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.createParentOffer(data);
    return result;
  }

  public async declineRequest(data: MarketContract.Actions.DeclineRequest.IDeclineRequest): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.declineRequest(data);
    return result;
  }

  public async deliverOnRequest(data: MarketContract.Actions.DeliverOnRequest.IDeliverOnRequest): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.deliverOnRequest(data);
    return result;
  }

  public async disputeOnRequest(data: MarketContract.Actions.OpenDispute.IOpenDispute): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.openDispute(data);
    return result;
  }

  public async moderateRequest(data: MarketContract.Actions.ModerateRequest.IModerateRequest): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.moderateRequest(data);
    return result;
  }

  public async prohibitRequest(data: MarketContract.Actions.ProhibitRequest.IProhibitRequest): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.prohibitRequest(data);
    return result;
  }

  public async publishRequest(data: MarketContract.Actions.PublishRequest.IPublishRequest): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.publishRequest(data);
    return result;
  }

  public async receiveOnRequest(data: ReceiveOnRequestInputDomainInterface): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.receiveOnRequest({
      ...data,
      document: { ...data.document, meta: JSON.stringify(data.document.meta) },
    });
    return result;
  }

  public async supplyOnRequest(data: SupplyOnRequestInputDomainInterface): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.supplyOnRequest({
      ...data,
      document: { ...data.document, meta: JSON.stringify(data.document.meta) },
    });
    return result;
  }

  public async unpublishRequest(data: MarketContract.Actions.UnpublishRequest.IUnpublishRequest): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.unpublishRequest(data);
    return result;
  }

  public async updateRequest(data: MarketContract.Actions.UpdateRequest.IUpdateRequest): Promise<TransactResult> {
    const result = await this.cooplaceBlockchainPort.updateRequest(data);
    return result;
  }

  public async reqReturn(data: ReqReturnInputDTO): Promise<TransactResult> {
    const doc: Record<string, any> = { ...(data.return_statement as any) };
    doc.meta = JSON.stringify(doc.meta);
    return await this.cooplaceBlockchainPort.reqReturn({
      coopname: this.config.coopname,
      username: data.username,
      request_hash: data.request_hash,
      return_statement: doc,
    });
  }

  public async coopstock(data: CoopstockInputDTO): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.coopstock({
      coopname: this.config.coopname,
      braname: data.braname,
      hash: data.hash,
      units: data.units,
      unit_cost: data.unit_cost,
      product_lifecycle_secs: data.product_lifecycle_secs,
      warranty_period_secs: data.warranty_period_secs,
      membership_fee_amount: data.membership_fee_amount,
      meta: data.meta,
    });
  }

  public async acceptStock(data: AcceptStockInputDTO): Promise<TransactResult> {
    const cin: Record<string, any> = { ...(data.convert_in as any) };
    cin.meta = JSON.stringify(cin.meta);
    const rs: Record<string, any> = { ...(data.return_statement as any) };
    rs.meta = JSON.stringify(rs.meta);
    return await this.cooplaceBlockchainPort.acceptStock({
      coopname: this.config.coopname,
      username: data.username,
      request_hash: data.request_hash,
      convert_in: cin,
      return_statement: rs,
    });
  }

  public async destroyRequest(data: DestroyRequestInputDTO): Promise<TransactResult> {
    const act: Record<string, any> = { ...(data.destruction_act as any) };
    act.meta = JSON.stringify(act.meta);
    return await this.cooplaceBlockchainPort.destroy({
      coopname: this.config.coopname,
      request_hash: data.request_hash,
      destruction_act: act,
    });
  }

  public async reofferRequest(data: ReofferRequestInputDTO): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.reoffer({
      coopname: this.config.coopname,
      request_hash: data.request_hash,
      new_hash: data.new_hash,
      new_unit_cost: data.new_unit_cost,
      new_meta: data.new_meta,
    });
  }
}
