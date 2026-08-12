import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { DocumentAggregator } from './document.aggregator';
import { DocumentPackageUtils } from './document-package-utils.aggregator';
import { AccountDomainService, ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import {
  UserCertificateDomainService,
  USER_CERTIFICATE_DOMAIN_SERVICE,
} from '~/domain/user/services/user-certificate-domain.service';
import { Cooperative, SovietContract } from 'cooptypes';
import { BlockchainActionHistoryService } from '~/domain/parser/services/blockchain-action-history.service';
import type { DocumentPackageAggregateDomainInterface } from '../interfaces/document-package-aggregate-domain.interface';
import type { StatementDetailAggregateDomainInterface } from '../interfaces/statement-detail-aggregate-domain.interface';
import type { DecisionDetailAggregateDomainInterface } from '../interfaces/decision-detail-aggregate-domain.interface';
import type { DocumentDomainAggregate } from '../aggregates/document-domain.aggregate';
import type { ISignedDocumentDomainInterface } from '../interfaces/signed-document-domain.interface';
import type { ExtendedBlockchainActionDomainInterface } from '~/domain/agenda/interfaces/extended-blockchain-action-domain.interface';

@Injectable()
export class DocumentPackageV0Aggregator {
  constructor(
    @Inject(forwardRef(() => DocumentAggregator)) private readonly documentAggregator: DocumentAggregator,
    @Inject(forwardRef(() => DocumentPackageUtils)) private readonly documentPackageUtils: DocumentPackageUtils,
    @Inject(forwardRef(() => ACCOUNT_DOMAIN_SERVICE)) private readonly accountDomainService: AccountDomainService,
    @Inject(forwardRef(() => USER_CERTIFICATE_DOMAIN_SERVICE))
    private readonly userCertificateService: UserCertificateDomainService,
    private readonly actionHistory: BlockchainActionHistoryService
  ) {}

  /**
   * Обрабатывает пакет документов версии 0 (устаревший формат)
   * @param rawAction Блокчейн-действие
   * @returns Агрегат пакета документов
   */
  async buildDocumentPackageAggregateV0(
    rawAction: Cooperative.Blockchain.IAction
  ): Promise<DocumentPackageAggregateDomainInterface> {
    // Инициализация частей
    let statementDetail: StatementDetailAggregateDomainInterface | null = null;
    let decisionDetail: DecisionDetailAggregateDomainInterface | null = null;
    const actDetails = [];
    const links: DocumentDomainAggregate[] = [];

    // Обработка данных в устаревшем формате
    interface legacyNewSubmitted {
      coopname: string;
      username: string;
      action: string;
      decision_id: number;
      document: Cooperative.Document.IChainDocument;
    }
    const rawData: legacyNewSubmitted = rawAction.data;

    // Создаем заявление (Statement)
    statementDetail = await this.buildStatementV0(rawAction, rawData, links);

    // Создаем решение (Decision)
    decisionDetail = await this.buildDecisionV0(rawData, links);

    // Возвращаем итоговый объект
    return {
      statement: statementDetail,
      decision: decisionDetail,
      acts: actDetails,
      links,
    };
  }

  /**
   * Создает заявление (Statement) для версии 0
   * @param rawAction Блокчейн-действие
   * @param rawData Данные действия
   * @param links Массив связанных документов
   * @returns Детали заявления
   */
  private async buildStatementV0(
    rawAction: Cooperative.Blockchain.IAction,
    rawData: any,
    links: DocumentDomainAggregate[]
  ): Promise<StatementDetailAggregateDomainInterface | null> {
    const mainDocument = await this.documentPackageUtils.getDocumentByHash(rawData.document.hash);

    if (mainDocument?.meta?.links && Array.isArray(mainDocument.meta.links)) {
      for (const linkHash of mainDocument.meta.links) {
        const linkedDoc = await this.documentPackageUtils.getDocumentByHash(linkHash);
        if (linkedDoc) {
          const signedLinkedDoc: ISignedDocumentDomainInterface = {
            version: '0',
            hash: linkedDoc.hash,
            doc_hash: linkedDoc.hash,
            meta_hash: this.documentPackageUtils.createMetaHash(linkedDoc.meta),
            meta: linkedDoc.meta,
            signatures: [],
          };
          const linkAggregate = await this.documentAggregator.buildDocumentAggregate(signedLinkedDoc);
          if (linkAggregate) {
            links.push(linkAggregate);
          }
        }
      }
    }

    const account = await this.accountDomainService.getPrivateAccount(rawData.username);
    if (account && mainDocument) {
      const actor_certificate = this.userCertificateService.createCertificateFromUserData(account);

      const extendedAction: ExtendedBlockchainActionDomainInterface = {
        ...rawAction,
        actor_certificate,
      };

      const signedMainDoc: ISignedDocumentDomainInterface = {
        version: '0',
        hash: mainDocument.hash,
        doc_hash: mainDocument.hash,
        meta_hash: this.documentPackageUtils.createMetaHash(mainDocument.meta),
        meta: mainDocument.meta,
        signatures: [
          {
            id: 1,
            signer: rawData.username,
            public_key: rawData.document.public_key,
            signature: rawData.document.signature,
            signed_at: mainDocument.meta.created_at,
            signed_hash: rawData.document.hash,
            meta: '',
          },
        ],
      };

      const documentAggregate = await this.documentAggregator.buildDocumentAggregate(signedMainDoc);
      if (documentAggregate) {
        return {
          action: extendedAction,
          documentAggregate,
        };
      }
    }

    return null;
  }

  /**
   * Создает решение (Decision) для версии 0
   * @param rawData Данные действия
   * @param links Массив связанных документов
   * @returns Детали решения
   */
  private async buildDecisionV0(
    rawData: any,
    links: DocumentDomainAggregate[]
  ): Promise<DecisionDetailAggregateDomainInterface | null> {
    const decisionAction = await this.actionHistory.findLast({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Registry.NewDecision.actionName,
      data: { decision_id: String(rawData.decision_id) },
    });
    if (!decisionAction) return null;

    const account = await this.accountDomainService.getPrivateAccount(decisionAction.data?.username);
    if (!account) return null;

    const actor_certificate = this.userCertificateService.createCertificateFromUserData(account);

    const extendedDecisionAction: ExtendedBlockchainActionDomainInterface = {
      ...decisionAction,
      actor_certificate,
    };

    const decisionDocument = await this.documentPackageUtils.getDocumentByHash(decisionAction?.data?.document?.hash);
    if (!decisionDocument) return null;

    if (decisionDocument?.meta?.links && Array.isArray(decisionDocument.meta.links)) {
      for (const linkHash of decisionDocument.meta.links) {
        const linkedDoc = await this.documentPackageUtils.getDocumentByHash(linkHash);
        if (linkedDoc) {
          const signedLinkedDoc: ISignedDocumentDomainInterface = {
            version: '0',
            hash: linkedDoc.hash,
            doc_hash: linkedDoc.hash,
            meta_hash: this.documentPackageUtils.createMetaHash(linkedDoc.meta),
            meta: linkedDoc.meta,
            signatures: [],
          };
          const linkAggregate = await this.documentAggregator.buildDocumentAggregate(signedLinkedDoc);
          if (linkAggregate) {
            links.push(linkAggregate);
          }
        }
      }
    }

    const signedDecisionDoc: ISignedDocumentDomainInterface = {
      version: '0',
      hash: decisionDocument.hash,
      doc_hash: decisionDocument.hash,
      meta_hash: this.documentPackageUtils.createMetaHash(decisionDocument.meta),
      meta: decisionDocument.meta,
      signatures: [
        {
          id: 1,
          signer: decisionAction.data?.username,
          public_key: decisionAction.data?.document.public_key,
          signature: decisionAction.data?.document.signature,
          signed_at: new Date().toISOString(),
          signed_hash: decisionAction.data?.document.hash,
          meta: '',
        },
      ],
    };

    const documentAggregate = await this.documentAggregator.buildDocumentAggregate(signedDecisionDoc);
    if (documentAggregate) {
      return {
        action: extendedDecisionAction,
        documentAggregate,
        votes_for: [],
        votes_against: [],
      };
    }

    return null;
  }
}
