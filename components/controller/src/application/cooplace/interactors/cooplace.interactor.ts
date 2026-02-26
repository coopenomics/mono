import { Injectable, Inject } from '@nestjs/common';
import { DocumentDomainService } from '~/domain/document/services/document-aggregation.service';
import { COOPLACE_BLOCKCHAIN_PORT, type CooplaceBlockchainPort } from '~/domain/cooplace/interfaces/cooplace-blockchain.port';
import { MarketContract, Cooperative } from 'cooptypes';
import { DocumentDomainEntity } from '~/domain/document/services/document-aggregation.service';
import type { AcceptChildOrderInputDomainInterface } from '~/domain/cooplace/interfaces/accept-child-order-input.interface';
import type { ConfirmReceiveOnRequestInputDomainInterface } from '~/domain/cooplace/interfaces/confirm-receive-on-request-input.interface';
import type { ConfirmSupplyOnRequestInputDomainInterface } from '~/domain/cooplace/interfaces/confirm-supply-on-request-input.interface';
import type { CreateChildOrderInputDomainInterface } from '~/domain/cooplace/interfaces/create-child-order-input.interface';
import type { ReceiveOnRequestInputDomainInterface } from '~/domain/cooplace/interfaces/receive-on-request-input.interface';
import type { SupplyOnRequestInputDomainInterface } from '~/domain/cooplace/interfaces/supply-on-request-input.interface';
import type { TransactResult } from '@wharfkit/session';
import type { Interfaces } from 'cooptypes';
import { config } from '~/config';
import type { ReqReturnInputDTO } from '../dto/req-return-input.dto';
import type { CoopstockInputDTO } from '../dto/coopstock-input.dto';
import type { AcceptStockInputDTO } from '../dto/accept-stock-input.dto';
import type { DestroyRequestInputDTO } from '../dto/destroy-request-input.dto';
import type { ReofferRequestInputDTO } from '../dto/reoffer-request-input.dto';

function serializeMeta(doc: { meta: any; [key: string]: any }): Interfaces.Marketplace.IDocument2 {
  return { ...doc, meta: JSON.stringify(doc.meta) } as Interfaces.Marketplace.IDocument2;
}

@Injectable()
export class CooplaceInteractor {
  private readonly config = config;

  constructor(
    private readonly documentDomainService: DocumentDomainService,
    @Inject(COOPLACE_BLOCKCHAIN_PORT) private readonly cooplaceBlockchainPort: CooplaceBlockchainPort
  ) {}

  // === Document generation ===

  async generateAssetContributionStatementDocument(data: Cooperative.Registry.AssetContributionStatement.Action, options: Cooperative.Document.IGenerationOptions): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AssetContributionStatement.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateAssetContributionDecisionDocument(data: Cooperative.Registry.AssetContributionDecision.Action, options: Cooperative.Document.IGenerationOptions): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AssetContributionDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateAssetContributionActDocument(data: Cooperative.Registry.AssetContributionAct.Action, options: Cooperative.Document.IGenerationOptions): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AssetContributionAct.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateReturnByAssetStatementDocument(data: Cooperative.Registry.ReturnByAssetStatement.Action, options: Cooperative.Document.IGenerationOptions): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.ReturnByAssetStatement.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateReturnByAssetDecisionDocument(data: Cooperative.Registry.ReturnByAssetDecision.Action, options: Cooperative.Document.IGenerationOptions): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.ReturnByAssetDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateReturnByAssetActDocument(data: Cooperative.Registry.ReturnByAssetAct.Action, options: Cooperative.Document.IGenerationOptions): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.ReturnByAssetAct.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  // === Blockchain actions (OFFER→ORDER) ===

  public async acceptChildOrder(data: AcceptChildOrderInputDomainInterface): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.acceptRequest({
      coopname: data.coopname,
      username: data.username,
      request_hash: data.request_hash,
      supplier_braname: data.supplier_braname,
      convert_out: serializeMeta(data.convert_out),
      return_document: serializeMeta(data.return_document),
    });
  }

  public async cancelRequest(data: Interfaces.Marketplace.ICancel): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.cancelRequest(data);
  }

  public async completeRequest(data: Interfaces.Marketplace.IComplete): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.completeRequest(data);
  }

  public async confirmReceiveOnRequest(data: ConfirmReceiveOnRequestInputDomainInterface): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.confirmOnReceive({
      coopname: data.coopname,
      username: data.username,
      request_hash: data.request_hash,
      document: serializeMeta(data.document),
    });
  }

  public async confirmSupplyOnRequest(data: ConfirmSupplyOnRequestInputDomainInterface): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.confirmOnSupply({
      coopname: data.coopname,
      username: data.username,
      request_hash: data.request_hash,
      act: serializeMeta(data.act),
    });
  }

  public async createChildOrder(data: CreateChildOrderInputDomainInterface): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.createChildOrder({
      coopname: data.coopname,
      receiver_braname: data.receiver_braname,
      username: data.username,
      hash: data.hash,
      units: data.units,
      unit_cost: data.unit_cost,
      product_lifecycle_secs: data.product_lifecycle_secs,
      warranty_period_secs: data.warranty_period_secs,
      membership_fee_amount: data.membership_fee_amount,
      cancellation_fee_amount: data.cancellation_fee_amount,
      convert_in: serializeMeta(data.convert_in),
      delivery_type: data.delivery_type,
      meta: data.meta,
    });
  }

  public async createParentOffer(data: any): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.createParentOffer(data);
  }

  public async declineRequest(data: Interfaces.Marketplace.IDecline): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.declineRequest(data);
  }

  public async deliverOnRequest(data: Interfaces.Marketplace.IDelivered): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.deliverOnRequest(data);
  }

  public async disputeOnRequest(data: Interfaces.Marketplace.IDispute): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.openDispute(data);
  }

  public async receiveOnRequest(data: ReceiveOnRequestInputDomainInterface): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.receiveOnRequest({
      coopname: data.coopname,
      username: data.username,
      request_hash: data.request_hash,
      document: serializeMeta(data.document),
    });
  }

  public async supplyOnRequest(data: SupplyOnRequestInputDomainInterface): Promise<TransactResult> {
    return await this.cooplaceBlockchainPort.supplyOnRequest({
      coopname: data.coopname,
      username: data.username,
      request_hash: data.request_hash,
      act: serializeMeta(data.act),
    });
  }

  // === New actions ===

  public async reqReturn(data: ReqReturnInputDTO): Promise<TransactResult> {
    const doc: Record<string, any> = { ...(data.return_statement as any) };
    doc.meta = JSON.stringify(doc.meta);
    return await this.cooplaceBlockchainPort.reqReturn({
      coopname: this.config.coopname,
      username: data.username,
      request_hash: data.request_hash,
      return_statement: doc as Interfaces.Marketplace.IDocument2,
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
      convert_in: cin as Interfaces.Marketplace.IDocument2,
      return_statement: rs as Interfaces.Marketplace.IDocument2,
    });
  }

  public async destroyRequest(data: DestroyRequestInputDTO): Promise<TransactResult> {
    const act: Record<string, any> = { ...(data.destruction_act as any) };
    act.meta = JSON.stringify(act.meta);
    return await this.cooplaceBlockchainPort.destroy({
      coopname: this.config.coopname,
      request_hash: data.request_hash,
      destruction_act: act as Interfaces.Marketplace.IDocument2,
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
