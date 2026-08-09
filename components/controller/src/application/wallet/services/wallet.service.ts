import { Injectable, Inject } from '@nestjs/common';
import { WalletInteractor } from '../interactors/wallet.interactor';
import {
  UserCertificateDomainPort,
  USER_CERTIFICATE_DOMAIN_PORT,
} from '~/domain/user/ports/user-certificate-domain.port';
import { WalletNotificationService } from './wallet-notification.service';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { ReturnByMoneyGenerateDocumentInputDTO } from '~/application/document/documents-dto/return-by-money-statement.dto';
import { ReturnByMoneyDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/return-by-money-decision.dto';
import { CreateWithdrawInputDTO } from '../dto/create-withdraw-input.dto';
import { CreateWithdrawResponseDTO } from '../dto/create-withdraw-response.dto';
import { ProgramWalletDTO } from '../dto/program-wallet.dto';
import { ProgramWalletFilterInputDTO } from '../dto/program-wallet-filter-input.dto';
import { UserWalletDTO } from '../dto/user-wallet.dto';
import { PaginationResult, PaginationInputDTO } from '@coopenomics/extension-kit';
import { Cooperative } from 'cooptypes';
import type { CreateDepositPaymentInputDTO } from '../../gateway/dto/create-deposit-payment-input.dto';
import type { GatewayPaymentDTO } from '../../gateway/dto/gateway-payment.dto';

/**
 * Сервис для работы с wallet модулем
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly walletInteractor: WalletInteractor,
    @Inject(USER_CERTIFICATE_DOMAIN_PORT)
    private readonly userCertificateDomainPort: UserCertificateDomainPort,
    private readonly walletNotificationService: WalletNotificationService
  ) {}

  /**
   * Создать депозитный платеж
   */
  public async createDepositPayment(data: CreateDepositPaymentInputDTO): Promise<GatewayPaymentDTO> {
    const result = await this.walletInteractor.createDepositPayment(data);
    const usernameCertificate = await this.userCertificateDomainPort.getCertificateByUsername(result.username);

    // Отправляем уведомление председателю о новой заявке на паевой взнос
    await this.walletNotificationService.sendNewDepositPaymentNotification(
      result.username,
      result.quantity.toFixed(2),
      result.symbol,
      result.coopname
    );

    return result.toDTO(usernameCertificate);
  }

  /**
   * Генерация документа заявления на возврат паевого взноса (900)
   */
  public async generateReturnByMoneyStatementDocument(
    data: ReturnByMoneyGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // Устанавливаем registry_id для документа заявления
    data.registry_id = Cooperative.Registry.ReturnByMoney.registry_id;

    const document = await this.walletInteractor.generateReturnByMoneyStatementDocument(data, options || {});
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  /**
   * Генерация документа решения совета о возврате паевого взноса (901)
   */
  public async generateReturnByMoneyDecisionDocument(
    data: ReturnByMoneyDecisionGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // Устанавливаем registry_id для документа решения
    data.registry_id = Cooperative.Registry.ReturnByMoneyDecision.registry_id;

    const document = await this.walletInteractor.generateReturnByMoneyDecisionDocument(data, options || {});
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  /**
   * Создание заявки на вывод средств
   */
  public async createWithdraw(data: CreateWithdrawInputDTO): Promise<CreateWithdrawResponseDTO> {
    const result = await this.walletInteractor.createWithdraw(data);

    const response = new CreateWithdrawResponseDTO();
    response.withdraw_hash = result.withdraw_hash;

    return response;
  }

  /**
   * Получить программные кошельки с пагинацией
   */
  public async getProgramWalletsPaginated(filter?: ProgramWalletFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<ProgramWalletDTO>> {
    const result = await this.walletInteractor.getProgramWalletsPaginated(filter, options);
    return {
      ...result,
      items: result.items.map((wallet) => ProgramWalletDTO.fromDomain(wallet)),
    };
  }

  /**
   * Получить один программный кошелек
   */
  public async getProgramWallet(filter: ProgramWalletFilterInputDTO): Promise<ProgramWalletDTO | null> {
    const wallet = await this.walletInteractor.getProgramWallet(filter);
    return wallet ? ProgramWalletDTO.fromDomain(wallet) : null;
  }

  /**
   * Получить кошельки пайщика «как есть» (без сворачивания share+member).
   */
  public async getUserWallets(username: string, coopname?: string): Promise<UserWalletDTO[]> {
    return this.walletInteractor.getUserWallets(username, coopname);
  }
}
