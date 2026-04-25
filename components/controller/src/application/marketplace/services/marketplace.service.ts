import { Injectable } from '@nestjs/common';
import type { AssetContributionStatementGenerateDocumentInputDTO } from '../../document/documents-dto/asset-contribution-statement-document.dto';
import type { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import type { AssetContributionActGenerateDocumentInputDTO } from '../../document/documents-dto/asset-contribution-act-document.dto';
import type { AssetContributionDecisionGenerateDocumentInputDTO } from '../../document/documents-dto/asset-contribution-decision-document.dto';
import type { ReturnByAssetActGenerateDocumentInputDTO } from '../../document/documents-dto/return-by-asset-act-document.dto';
import type { ReturnByAssetDecisionGenerateDocumentInputDTO } from '../../document/documents-dto/return-by-asset-decision-document.dto';
import type { ReturnByAssetStatementGenerateDocumentInputDTO } from '../../document/documents-dto/return-by-asset-statement-document.dto';
import { MarketplaceInteractor } from '../interactors/marketplace.interactor';
import type { ReqReturnInputDTO } from '../dto/req-return-input.dto';
import type { CoopstockInputDTO } from '../dto/coopstock-input.dto';
import type { AcceptStockInputDTO } from '../dto/accept-stock-input.dto';
import type { DestroyRequestInputDTO } from '../dto/destroy-request-input.dto';
import type { ReofferRequestInputDTO } from '../dto/reoffer-request-input.dto';
import type { AcceptChildOrderInputDTO } from '../dto/accept-child-order-input.dto';
import type { CancelRequestInputDTO } from '../dto/cancel-request-input.dto';
import type { CompleteRequestInputDTO } from '../dto/complete-request-input.dto';
import type { ConfirmReceiveOnRequestInputDTO } from '../dto/confirm-receive-on-request.dto';
import type { ConfirmSupplyOnRequestInputDTO } from '../dto/confirm-supply-on-request.dto';
import type { CreateChildOrderInputDTO } from '../dto/create-child-order-input.dto';
import type { DeliverOnRequestInputDTO } from '../dto/deliver-on-request-input.dto';
import type { CreateParentOfferInputDTO } from '../dto/create-parent-offer-input.dto';
import type { DeclineRequestInputDTO } from '../dto/decline-request-input.dto';
import type { DisputeOnRequestInputDTO } from '../dto/dispute-on-request-input.dto';
import type { PublishRequestInputDTO } from '../dto/publish-request-input.dto';
import type { ModerateRequestInputDTO } from '../dto/moderate-request-input.dto';
import type { ProhibitRequestInputDTO } from '../dto/prohibit-request-input.dto';
import type { ReceiveOnRequestInputDTO } from '../dto/receive-on-request-input.dto';
import type { SupplyOnRequestInputDTO } from '../dto/supply-on-request-input.dto';
import type { UnpublishRequestInputDTO } from '../dto/unpublish-request-input.dto';
import type { UpdateRequestInputDTO } from '../dto/update-request-input.dto';
import type { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import type { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';

@Injectable()
export class MarketplaceService {
  constructor(private readonly marketplaceInteractor: MarketplaceInteractor) {}

  public async generateAssetContributionStatement(
    data: AssetContributionStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.marketplaceInteractor.generateAssetContributionStatementDocument(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateAssetContributionDecision(
    data: AssetContributionDecisionGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.marketplaceInteractor.generateAssetContributionDecisionDocument(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateAssetContributionAct(
    data: AssetContributionActGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.marketplaceInteractor.generateAssetContributionActDocument(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateReturnByAssetStatement(
    data: ReturnByAssetStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.marketplaceInteractor.generateReturnByAssetStatementDocument(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateReturnByAssetDecision(
    data: ReturnByAssetDecisionGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.marketplaceInteractor.generateReturnByAssetDecisionDocument(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateReturnByAssetAct(
    data: ReturnByAssetActGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.marketplaceInteractor.generateReturnByAssetActDocument(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }

  public async acceptChildOrder(data: AcceptChildOrderInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.acceptChildOrder(data);
    return result;
  }

  public async cancelRequest(data: CancelRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.cancelRequest(data);
    return result;
  }

  public async completeRequest(data: CompleteRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.completeRequest(data);
    return result;
  }

  public async confirmReceiveOnRequest(data: ConfirmReceiveOnRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.confirmReceiveOnRequest(data);
    return result;
  }

  public async confirmSupplyOnRequest(data: ConfirmSupplyOnRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.confirmSupplyOnRequest(data);
    return result;
  }

  public async createChildOrder(data: CreateChildOrderInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.createChildOrder({ params: data });
    return result;
  }

  public async createParentOffer(data: CreateParentOfferInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.createParentOffer({ params: data });
    return result;
  }

  public async declineRequest(data: DeclineRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.declineRequest(data);
    return result;
  }

  public async deliverOnRequest(data: DeliverOnRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.deliverOnRequest(data);
    return result;
  }

  public async disputeOnRequest(data: DisputeOnRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.disputeOnRequest(data);
    return result;
  }

  public async moderateRequest(data: ModerateRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.moderateRequest(data);
    return result;
  }

  public async prohibitRequest(data: ProhibitRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.prohibitRequest(data);
    return result;
  }

  public async publishRequest(data: PublishRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.publishRequest(data);
    return result;
  }

  public async receiveOnRequest(data: ReceiveOnRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.receiveOnRequest(data);
    return result;
  }

  public async supplyOnRequest(data: SupplyOnRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.supplyOnRequest(data);
    return result;
  }

  public async unpublishRequest(data: UnpublishRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.unpublishRequest(data);
    return result;
  }

  public async updateRequest(data: UpdateRequestInputDTO): Promise<TransactionDTO> {
    const result = await this.marketplaceInteractor.updateRequest(data);
    return result;
  }

  public async reqReturn(data: ReqReturnInputDTO): Promise<TransactionDTO> {
    return await this.marketplaceInteractor.reqReturn(data);
  }

  public async coopstock(data: CoopstockInputDTO): Promise<TransactionDTO> {
    return await this.marketplaceInteractor.coopstock(data);
  }

  public async acceptStock(data: AcceptStockInputDTO): Promise<TransactionDTO> {
    return await this.marketplaceInteractor.acceptStock(data);
  }

  public async destroyRequest(data: DestroyRequestInputDTO): Promise<TransactionDTO> {
    return await this.marketplaceInteractor.destroyRequest(data);
  }

  public async reofferRequest(data: ReofferRequestInputDTO): Promise<TransactionDTO> {
    return await this.marketplaceInteractor.reofferRequest(data);
  }
}
