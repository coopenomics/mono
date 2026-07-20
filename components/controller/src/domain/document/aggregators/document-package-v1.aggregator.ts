import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { DocumentAggregator } from './document.aggregator';
import { DocumentPackageUtils } from './document-package-utils.aggregator';
import { AccountDomainService, ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import {
  UserCertificateDomainService,
  USER_CERTIFICATE_DOMAIN_SERVICE,
} from '~/domain/user/services/user-certificate-domain.service';
import { Cooperative, SovietContract } from 'cooptypes';
import { getActions } from '~/utils/getFetch';
import type { DocumentPackageAggregateDomainInterface } from '../interfaces/document-package-aggregate-domain.interface';
import type { StatementDetailAggregateDomainInterface } from '../interfaces/statement-detail-aggregate-domain.interface';
import type { DecisionDetailAggregateDomainInterface } from '../interfaces/decision-detail-aggregate-domain.interface';
import type { DocumentDomainAggregate } from '../aggregates/document-domain.aggregate';
import type { ISignedDocumentDomainInterface } from '../interfaces/signed-document-domain.interface';
import type { ExtendedBlockchainActionDomainInterface } from '~/domain/agenda/interfaces/extended-blockchain-action-domain.interface';

@Injectable()
export class DocumentPackageV1Aggregator {
  constructor(
    @Inject(forwardRef(() => DocumentAggregator)) private readonly documentAggregator: DocumentAggregator,
    @Inject(forwardRef(() => DocumentPackageUtils)) private readonly documentPackageUtils: DocumentPackageUtils,
    @Inject(forwardRef(() => ACCOUNT_DOMAIN_SERVICE)) private readonly accountDomainService: AccountDomainService,
    @Inject(forwardRef(() => USER_CERTIFICATE_DOMAIN_SERVICE))
    private readonly userCertificateService: UserCertificateDomainService
  ) {}

  /**
   * Обрабатывает пакет документов версии 1 и выше (новый формат)
   * @param rawAction Блокчейн-действие
   * @returns Агрегат пакета документов
   */
  async buildDocumentPackageAggregateV1(
    rawAction: Cooperative.Blockchain.IAction
  ): Promise<DocumentPackageAggregateDomainInterface> {
    // Инициализация частей
    let statementDetail: StatementDetailAggregateDomainInterface | null = null;
    let decisionDetail: DecisionDetailAggregateDomainInterface | null = null;
    const links: DocumentDomainAggregate[] = [];

    // Обработка данных в новом формате
    const rawData: SovietContract.Actions.Registry.NewSubmitted.INewSubmitted = rawAction.data;

    // Создаем заявление (Statement)
    statementDetail = await this.buildStatementV1(rawAction, rawData, links);

    // Создаем решение (Decision)
    decisionDetail = await this.buildDecisionV1(rawData, links);

    // Создаем акты (Acts)
    const actDetails = await this.buildActsV1(rawData, links);

    // Собираем дополнительные связанные документы
    await this.buildLinksV1(rawData, links);

    // Возвращаем итоговый объект
    return {
      statement: statementDetail,
      decision: decisionDetail,
      acts: actDetails,
      links,
    };
  }

  /**
   * Создает заявление (Statement) для версии 1+
   * @param rawAction Блокчейн-действие
   * @param rawData Данные действия
   * @param links Массив связанных документов
   * @returns Детали заявления
   */
  private async buildStatementV1(
    rawAction: Cooperative.Blockchain.IAction,
    rawData: SovietContract.Actions.Registry.NewSubmitted.INewSubmitted,
    links: DocumentDomainAggregate[]
  ): Promise<StatementDetailAggregateDomainInterface | null> {
    const mainDocument = await this.documentPackageUtils.getDocumentByHash(rawData.document.doc_hash);
    if (!mainDocument) return null;

    if (mainDocument?.meta?.links && Array.isArray(mainDocument.meta.links)) {
      for (const linkHash of mainDocument.meta.links) {
        const linkAggregate = await this.buildLinkedAggregate(linkHash, rawData.document.version);
        if (linkAggregate) {
          links.push(linkAggregate);
        }
      }
    }

    const account = await this.accountDomainService.getPrivateAccount(rawData.username);
    if (!account) return null;

    const actor_certificate = this.userCertificateService.createCertificateFromUserData(account);

    const extendedAction: ExtendedBlockchainActionDomainInterface = {
      ...rawAction,
      actor_certificate,
    };

    // signatures уже есть в rawData.document
    const signedMainDoc: ISignedDocumentDomainInterface = {
      version: rawData.document.version,
      hash: rawData.document.hash,
      doc_hash: rawData.document.doc_hash,
      meta_hash: rawData.document.meta_hash,
      meta: mainDocument.meta,
      signatures: rawData.document.signatures,
    };

    const documentAggregate = await this.documentAggregator.buildDocumentAggregate(signedMainDoc);
    if (documentAggregate) {
      return {
        action: extendedAction,
        documentAggregate,
      };
    }

    return null;
  }

  /**
   * Создает решение (Decision) для версии 1+
   * @param rawData Данные действия
   * @param links Массив связанных документов
   * @returns Детали решения
   */
  private async buildDecisionV1(
    rawData: SovietContract.Actions.Registry.NewSubmitted.INewSubmitted,
    links: DocumentDomainAggregate[]
  ): Promise<DecisionDetailAggregateDomainInterface | null> {
    const decisionActionResponse = await getActions(`${process.env.SIMPLE_EXPLORER_API}/get-actions`, {
      filter: JSON.stringify({
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Registry.NewDecision.actionName,
        receiver: process.env.COOPNAME,
        'data.package': String(rawData.package.toUpperCase()),
      }),
      page: 1,
      limit: 1,
    });

    const decisionAction = decisionActionResponse?.results?.[0];
    if (!decisionAction) return null;

    const account = await this.accountDomainService.getPrivateAccount(decisionAction.data?.username);
    if (!account) return null;

    const actor_certificate = this.userCertificateService.createCertificateFromUserData(account);

    const extendedDecisionAction: ExtendedBlockchainActionDomainInterface = {
      ...decisionAction,
      actor_certificate,
    };

    const decisionDocument = await this.documentPackageUtils.getDocumentByHash(decisionAction?.data?.document?.doc_hash);
    if (!decisionDocument) return null;

    if (decisionDocument?.meta?.links && Array.isArray(decisionDocument.meta.links)) {
      for (const linkHash of decisionDocument.meta.links) {
        const linkAggregate = await this.buildLinkedAggregate(linkHash, decisionAction.data?.document?.version);
        if (linkAggregate) {
          links.push(linkAggregate);
        }
      }
    }

    // signatures уже есть в decisionAction.data.document
    const signedDecisionDoc: ISignedDocumentDomainInterface = {
      version: decisionAction.data?.document?.version,
      hash: decisionAction.data?.document?.hash,
      doc_hash: decisionAction.data?.document?.doc_hash,
      meta_hash: decisionAction.data?.document?.meta_hash,
      meta: decisionDocument.meta,
      signatures: decisionAction.data?.document?.signatures || [],
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

  /**
   * Создает акты (Acts) для версии 1+
   * @param rawData Данные действия
   * @param links Массив связанных документов
   * @returns Массив деталей актов
   */
  private async buildActsV1(
    rawData: SovietContract.Actions.Registry.NewSubmitted.INewSubmitted,
    links: DocumentDomainAggregate[]
  ): Promise<DecisionDetailAggregateDomainInterface[]> {
    const actsActionResponse = await getActions(`${process.env.SIMPLE_EXPLORER_API}/get-actions`, {
      filter: JSON.stringify({
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Registry.NewAct.actionName,
        receiver: process.env.COOPNAME,
        'data.package': String(rawData.package.toUpperCase()),
      }),
      page: 1,
      limit: 100, // Получаем до 100 актов для пакета
    });

    const actsResults = actsActionResponse?.results || [];
    const actsDetails: DecisionDetailAggregateDomainInterface[] = [];

    for (const actAction of actsResults) {
      const account = await this.accountDomainService.getPrivateAccount(actAction.data?.username);
      if (!account) continue;

      const actor_certificate = this.userCertificateService.createCertificateFromUserData(account);

      const extendedActAction: ExtendedBlockchainActionDomainInterface = {
        ...actAction,
        actor_certificate,
      };

      const actDocument = await this.documentPackageUtils.getDocumentByHash(actAction?.data?.document?.doc_hash);
      if (!actDocument) continue;

      if (actDocument?.meta?.links && Array.isArray(actDocument.meta.links)) {
        for (const linkHash of actDocument.meta.links) {
          const linkAggregate = await this.buildLinkedAggregate(linkHash, actAction.data?.document?.version);
          if (linkAggregate) {
            links.push(linkAggregate);
          }
        }
      }

      // signatures уже есть в actAction.data.document
      const signedActDoc: ISignedDocumentDomainInterface = {
        version: actAction.data?.document?.version,
        hash: actAction.data?.document?.hash,
        doc_hash: actAction.data?.document?.doc_hash,
        meta_hash: actAction.data?.document?.meta_hash,
        meta: actDocument.meta,
        signatures: actAction.data?.document?.signatures || [],
      };

      const documentAggregate = await this.documentAggregator.buildDocumentAggregate(signedActDoc);
      if (documentAggregate) {
        actsDetails.push({
          action: extendedActAction,
          documentAggregate,
          votes_for: [],
          votes_against: [],
        });
      }
    }

    return actsDetails;
  }

  /**
   * Строит агрегат связанного с заявлением документа (приложения) по его хэшу.
   *
   * Подписанный носитель соглашения ищется в двух источниках, потому что
   * соглашения уходят на цепь двумя путями:
   *   - непрограммные (program_id == 0) — через soviet::sndagreement,
   *     создавая действие реестра soviet::newagreement;
   *   - программные оферты ЦПП (program_id > 0, Эпик 2) — через wallet::signagree,
   *     которое пишет в wallet::users.programs[] и НЕ создаёт soviet::newagreement.
   *
   * Раньше все соглашения шли через soviet::sndagreement, поэтому агрегатор искал
   * приложение только в soviet::newagreement. После перевода программных оферт на
   * wallet::signagree они перестали находиться и молча выпадали из приложений к
   * заявлению на повестке совета. Фолбэк на wallet::signagree восстанавливает связь.
   *
   * @returns агрегат документа либо null, если документ или носитель подписи не найдены
   */
  private async buildLinkedAggregate(
    linkHash: string,
    version: string
  ): Promise<DocumentDomainAggregate | null> {
    const linkedDoc = await this.documentPackageUtils.getDocumentByHash(linkHash);
    if (!linkedDoc) return null;

    const agreementDocument = await this.findLinkedAgreementDocument(linkHash);
    if (!agreementDocument) return null;

    const signedLinkedDoc: ISignedDocumentDomainInterface = {
      version,
      hash: linkedDoc.hash,
      doc_hash: linkedDoc.hash,
      meta_hash: agreementDocument.meta_hash,
      meta: typeof agreementDocument.meta === 'string' ? JSON.parse(agreementDocument.meta) : agreementDocument.meta,
      signatures: agreementDocument.signatures || [],
    };

    return this.documentAggregator.buildDocumentAggregate(signedLinkedDoc);
  }

  /**
   * Находит on-chain действие-носитель подписанного связанного документа по doc_hash.
   * Сначала ищет в реестре соглашений совета (soviet::newagreement — второе,
   * явное уведомление, которое дополнительно шлёт soviet::sndagreement), затем —
   * в общем уведомлении о завершённом документе (soviet::newresolved), которое
   * централизованно шлёт make_complete_document (lib/core/soviet/soviet.hpp) на
   * КАЖДЫЙ вызов — и из soviet::sndagreement, и из wallet::signagree — с
   * require_recipient(coopname), заданным один раз внутри newresolved.cpp.
   * Программные оферты (capital: Благорост/Генератор, program_id>0) идут через
   * wallet::signagree и не порождают newagreement, но newresolved у них есть
   * всегда — расширять notification-поверхность самого wallet::signagree не
   * нужно, единственное место для этого уже newresolved.cpp.
   * Возвращает поле document найденного действия либо null.
   */
  private async findLinkedAgreementDocument(
    linkHash: string
  ): Promise<{ meta_hash: string; meta: string; signatures: any[] } | null> {
    const docHashFilter = String(linkHash.toUpperCase());

    const sovietAgreement = await getActions(`${process.env.SIMPLE_EXPLORER_API}/get-actions`, {
      filter: JSON.stringify({
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Registry.NewAgreement.actionName,
        receiver: process.env.COOPNAME,
        'data.document.doc_hash': docHashFilter,
      }),
      page: 1,
      limit: 1,
    });

    const sovietDocument = sovietAgreement?.results?.[0]?.data?.document;
    if (sovietDocument) return sovietDocument;

    const resolvedAgreement = await getActions(`${process.env.SIMPLE_EXPLORER_API}/get-actions`, {
      filter: JSON.stringify({
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Registry.NewResolved.actionName,
        receiver: process.env.COOPNAME,
        'data.document.doc_hash': docHashFilter,
      }),
      page: 1,
      limit: 1,
    });

    const resolvedDocument = resolvedAgreement?.results?.[0]?.data?.document;
    if (resolvedDocument) return resolvedDocument;

    return null;
  }

  /**
   * Собирает связанные документы (Links) для версии 1+
   * @param rawData Данные действия
   * @param links Массив связанных документов
   */
  private async buildLinksV1(
    rawData: SovietContract.Actions.Registry.NewSubmitted.INewSubmitted,
    links: DocumentDomainAggregate[]
  ): Promise<void> {
    const linksActionResponse = await getActions(`${process.env.SIMPLE_EXPLORER_API}/get-actions`, {
      filter: JSON.stringify({
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Registry.NewLink.actionName,
        receiver: process.env.COOPNAME,
        'data.package': String(rawData.package.toUpperCase()),
      }),
      page: 1,
      limit: 10000, // Получаем до 10000 связанных документов для пакета
    });

    const linksResults = linksActionResponse?.results || [];

    for (const linkAction of linksResults) {
      const linkDocument = await this.documentPackageUtils.getDocumentByHash(linkAction?.data?.document?.doc_hash);
      if (!linkDocument) continue;

      const linkAggregate = await this.documentAggregator.buildDocumentAggregate(linkAction?.data?.document);
      if (linkAggregate) {
        links.push(linkAggregate);
      }
    }
  }
}
