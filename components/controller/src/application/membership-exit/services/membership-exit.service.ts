import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cooperative, Ledger2 } from 'cooptypes';
import { Workflows } from '@coopenomics/notifications';
import { config } from '~/config';
import { ParticipantInteractor } from '~/application/participant/interactors/participant.interactor';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { NotificationSenderService } from '~/application/notification/services/notification-sender.service';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { ACCOUNT_BLOCKCHAIN_PORT, type AccountBlockchainPort } from '~/domain/account/interfaces/account-blockchain.port';
import { USER_WALLET_REPOSITORY, type UserWalletRepository } from '~/domain/wallet/repositories/user-wallet.repository';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { USER_DOMAIN_SERVICE, type UserDomainService } from '~/domain/user/services/user-domain.service';
import { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { PAYMENT_METHOD_REPOSITORY, type PaymentMethodRepository } from '~/domain/common/repositories/payment-method.repository';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';
import { MembershipExitRequestEntity } from '~/infrastructure/database/typeorm/entities/membership-exit-request.entity';
import { tokenTypes } from '~/types/token.types';
import { CreateMembershipExitInputDTO } from '../dto/create-membership-exit-input.dto';
import { MembershipExitResultDTO } from '../dto/membership-exit-result.dto';
import { MembershipExitReturnPreviewDTO } from '../dto/membership-exit-return-preview.dto';
import { MembershipExitDTO } from '../dto/membership-exit.dto';
import { MembershipExitStatus } from '../enums/membership-exit-status.enum';

@Injectable()
export class MembershipExitService {
  private readonly logger = new Logger(MembershipExitService.name);

  constructor(
    private readonly participantInteractor: ParticipantInteractor,
    private readonly tokenApplicationService: TokenApplicationService,
    private readonly notificationSenderService: NotificationSenderService,
    @Inject(ACCOUNT_BLOCKCHAIN_PORT)
    private readonly accountBlockchainPort: AccountBlockchainPort,
    @Inject(USER_WALLET_REPOSITORY)
    private readonly userWalletRepository: UserWalletRepository,
    @Inject(BLOCKCHAIN_PORT)
    private readonly blockchainPort: BlockchainPort,
    @Inject(USER_DOMAIN_SERVICE)
    private readonly userDomainService: UserDomainService,
    @Inject(PAYMENT_METHOD_REPOSITORY)
    private readonly paymentMethodRepository: PaymentMethodRepository,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository,
    @InjectRepository(MembershipExitRequestEntity)
    private readonly exitRequestRepository: Repository<MembershipExitRequestEntity>
  ) {}

  async generateMembershipExitApplication(
    data: Cooperative.Registry.ParticipantExitApplication.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.participantInteractor.generateMembershipExitApplication(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }

  async generateMembershipExitDecision(
    data: Cooperative.Registry.DecisionOfParticipantExit.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.participantInteractor.generateMembershipExitDecision(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }

  /**
   * Подача заявления на выход. Заявление подписывается пайщиком на клиенте и
   * сразу принимается: сохраняется off-chain и требует подтверждения по ссылке
   * из письма. В блокчейн (registrator::exitcoop) отправляется только после
   * перехода по ссылке — см. confirmMembershipExit. Это двойное подтверждение
   * необратимого действия (закрытие аккаунта). Пайщик подаёт выход за себя;
   * председатель/член совета — за любого пайщика (операторская подача).
   */
  async createMembershipExit(
    data: CreateMembershipExitInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<MembershipExitResultDTO> {
    const isOperator = currentUser.role === 'chairman' || currentUser.role === 'member';
    if (!isOperator && data.username !== currentUser.username) {
      throw new ForbiddenException('Подать заявление на выход можно только за себя');
    }

    // Гард повторного выхода: вышедший пайщик заблокирован on-chain (completexit →
    // status=blocked + удалён из участников). Контракт exitcoop его уже не пропустит
    // (get_participant_or_fail), но отсекаем раньше — чтобы не плодить off-chain
    // черновик и не доводить пайщика до провала на шаге подтверждения по ссылке.
    const account = await this.accountBlockchainPort.getUserAccount(data.username);
    if (String(account?.status) === 'blocked') {
      throw new BadRequestException('Вы уже вышли из кооператива — повторный выход невозможен.');
    }

    // Гейт реквизитов: выход нельзя запускать, пока у пайщика нет реквизитов для
    // получения возврата паевого взноса — иначе при одобрении совета исходящий
    // платёж возврата некуда будет создать (см. MembershipExitAuthorizationListener).
    const methods = await this.paymentMethodRepository.list({
      username: data.username,
      page: 1,
      limit: 1,
      sortOrder: 'DESC',
    });
    if (!methods || methods.items.length === 0) {
      throw new BadRequestException(
        'Для выхода из кооператива установите реквизиты для получения возврата паевого взноса.'
      );
    }

    // Уже идёт выход on-chain?
    const onchain = await this.accountBlockchainPort.getExit(data.coopname, data.username);
    if (onchain) {
      throw new BadRequestException('Процесс выхода уже запущен и отправлен в блокчейн');
    }

    // Уже есть заявление, ожидающее подтверждения по email?
    const existing = await this.exitRequestRepository.findOne({
      where: { coopname: data.coopname, username: data.username },
    });
    if (existing) {
      throw new BadRequestException(
        'Заявление на выход уже подано и ожидает подтверждения по ссылке из письма'
      );
    }

    const user = await this.userDomainService.getUserByUsername(data.username);
    const confirmToken = await this.tokenApplicationService.generateConfirmExitToken(user.id);

    await this.exitRequestRepository.save(
      this.exitRequestRepository.create({
        coopname: data.coopname,
        username: data.username,
        exit_hash: data.exit_hash,
        statement: data.statement as unknown as Record<string, any>,
        token: confirmToken,
      })
    );

    const confirmationUrl = `${config.frontend_url}/${config.coopname}/user/membership-exit/confirm?token=${confirmToken}`;
    this.logger.debug(`Ссылка подтверждения выхода (${data.username}): ${confirmationUrl}`);

    // Письмо — не критично для приёма заявления: черновик уже сохранён, и если
    // провайдер писем недоступен, пайщик не теряет заявление (можно отменить).
    try {
      await this.notificationSenderService.sendNotificationToUser(
        data.username,
        Workflows.MembershipExitConfirmation.id,
        { confirmationUrl }
      );
    } catch (e: any) {
      this.logger.error(
        `Не удалось отправить письмо с подтверждением выхода (${data.username}): ${e?.message ?? e}`
      );
    }

    this.logger.log(
      `Принято заявление на выход (ожидает email-подтверждения): ${data.exit_hash} (username=${data.username})`
    );

    return { exit_hash: data.exit_hash, status: MembershipExitStatus.AWAITING_CONFIRMATION };
  }

  /**
   * Подтверждение выхода по ссылке из письма. Проверяет токен, берёт сохранённое
   * подписанное заявление и только теперь отправляет его в блокчейн
   * (registrator::exitcoop ключом кооператива). Запись-черновик удаляется —
   * далее источником истины служит on-chain registrator::exits.
   */
  async confirmMembershipExit(token: string): Promise<MembershipExitResultDTO> {
    await this.tokenApplicationService.verifyToken({ token, types: [tokenTypes.CONFIRM_EXIT] });

    const request = await this.exitRequestRepository.findOne({ where: { token } });
    if (!request) {
      throw new NotFoundException('Заявление на выход не найдено или уже подтверждено');
    }

    await this.accountBlockchainPort.exitCoop({
      coopname: request.coopname,
      username: request.username,
      exit_hash: request.exit_hash,
      statement: request.statement as any,
    });

    await this.exitRequestRepository.delete({ id: request.id });
    await this.tokenApplicationService.findOneAndDelete(token, tokenTypes.CONFIRM_EXIT);

    this.logger.log(
      `Выход подтверждён и отправлен в блокчейн: ${request.exit_hash} (username=${request.username})`
    );

    return { exit_hash: request.exit_hash, status: MembershipExitStatus.PENDING };
  }

  /**
   * Отмена заявления на выход до подтверждения по email. Удаляет черновик и
   * аннулирует токен подтверждения. Доступно пайщику (за себя) и оператору.
   */
  async cancelMembershipExit(
    coopname: string,
    username: string,
    currentUser: MonoAccountDomainInterface
  ): Promise<boolean> {
    const isOperator = currentUser.role === 'chairman' || currentUser.role === 'member';
    if (!isOperator && username !== currentUser.username) {
      throw new ForbiddenException('Отменить выход можно только за себя');
    }

    const request = await this.exitRequestRepository.findOne({ where: { coopname, username } });
    if (!request) {
      throw new BadRequestException('Нет заявления на выход, ожидающего подтверждения');
    }

    await this.exitRequestRepository.delete({ id: request.id });
    await this.tokenApplicationService.findOneAndDelete(request.token, tokenTypes.CONFIRM_EXIT);

    this.logger.log(`Заявление на выход отменено до подтверждения (username=${username})`);
    return true;
  }

  /**
   * Текущий процесс выхода пайщика (если активен) — для блокировки кабинета и
   * отображения статуса заявления и планируемой суммы возврата. null — выхода нет.
   */
  async getMembershipExit(coopname: string, username: string): Promise<MembershipExitDTO | null> {
    const exit = await this.accountBlockchainPort.getExit(coopname, username);
    if (exit) {
      // Статус исходящего платежа возврата (заводится при одобрении советом —
      // см. MembershipExitAuthorizationListener). hash платежа = exit_hash.
      const payment = await this.paymentRepository.findByHash(exit.exit_hash);
      return {
        exit_hash: exit.exit_hash,
        status: exit.status as MembershipExitStatus,
        quantity: exit.quantity,
        payment_status: payment?.status,
        created_at: exit.created_at,
      };
    }

    // Off-chain фаза: заявление подписано, но ещё не подтверждено по email.
    const pending = await this.exitRequestRepository.findOne({ where: { coopname, username } });
    if (pending) {
      return {
        exit_hash: pending.exit_hash,
        status: MembershipExitStatus.AWAITING_CONFIRMATION,
        quantity: '',
        created_at: pending.created_at.toISOString(),
      };
    }

    // Терминальная фаза: выход завершён on-chain. После completexit строка
    // registrator::exits СТЁРТА (терминал=erase), аккаунт переведён в blocked.
    // exits-строки уже нет — источник терминального состояния: blocked-аккаунт +
    // персистентный MEMBERSHIP_EXIT-платёж в gateway (сумма возврата + «оплачено»).
    // Так кабинет остаётся заблокированным экраном «вы вышли» и после стирания
    // exits, и при следующих входах (blocked-статус живёт on-chain).
    const account = await this.accountBlockchainPort.getUserAccount(username);
    if (String(account?.status) === 'blocked') {
      const payment = await this.paymentRepository.findLatestByUsernameAndType(
        username,
        PaymentTypeEnum.MEMBERSHIP_EXIT
      );
      if (payment) {
        const precision = config.blockchain.root_govern_precision ?? 4;
        return {
          exit_hash: payment.hash,
          status: MembershipExitStatus.COMPLETED,
          quantity: `${payment.quantity.toFixed(precision)} ${payment.symbol}`,
          payment_status: payment.status,
          created_at: (payment.completed_at ?? payment.created_at).toISOString(),
        };
      }
    }

    return null;
  }

  /**
   * Предварительный расчёт суммы возврата паевого взноса при выходе пайщика.
   *
   * Считается обходом сета паевых кошельков Ledger2.EXIT_REFUND_WALLET_NAMES
   * (w.reg.minshr + w.wal.share + w.cap.blago) по L3-балансам — тот же сет, что
   * обходит контракт `confirmexit` при одобрении выхода советом, поэтому preview
   * совпадает с суммой, которую реально вернёт контракт.
   */
  async getReturnPreview(coopname: string, username: string): Promise<MembershipExitReturnPreviewDTO> {
    const wallets = Ledger2.EXIT_REFUND_WALLET_NAMES;
    const rows = await Promise.all(
      wallets.map((wallet) => this.userWalletRepository.findByWalletAndUsername(coopname, wallet, username)),
    );

    // available учитываем только для существующих (present) кошельков
    const balances = rows.map((row) => (row?.present !== false ? row?.available : undefined));

    const template = await this.resolveAssetTemplate(coopname, balances.find((b) => !!b));
    const zero = this.zeroAssetLike(template);

    const assets = balances.map((b) => b ?? zero);
    const total = assets.reduce((acc, a) => this.sumAssets(acc, a), zero);

    // индивидуальные паевые отдаём для информации; фронт показывает total
    const balanceOf = (wallet: string): string => {
      const idx = wallets.indexOf(wallet);
      return idx >= 0 ? assets[idx] : zero;
    };

    return {
      total,
      share_contribution: balanceOf(Ledger2.SHARE_WALLET_NAME),
      minimum_contribution: balanceOf(Ledger2.MIN_SHARE_WALLET_NAME),
    };
  }

  /** Сумма двух asset-строк одного символа («100.0000 RUB»). */
  private sumAssets(a: string, b: string): string {
    const [amountA, sym] = a.split(' ');
    const [amountB] = b.split(' ');
    const precision = (amountA.split('.')[1] || '').length;
    const total = Number(amountA) + Number(amountB);
    return `${total.toFixed(precision)} ${sym}`;
  }

  /** Нулевой asset в символе/точности образца. */
  private zeroAssetLike(template: string): string {
    const [amount, sym] = template.split(' ');
    const precision = (amount.split('.')[1] || '').length;
    return `${(0).toFixed(precision)} ${sym}`;
  }

  /** Образец asset для нулей — из имеющегося баланса либо из настроек кооператива. */
  private async resolveAssetTemplate(coopname: string, sample?: string): Promise<string> {
    if (sample) return sample;
    const coop = await this.blockchainPort.getCooperative(coopname);
    const precision = config.blockchain.root_govern_precision ?? 4;
    const symbol = config.blockchain.root_govern_symbol ?? 'RUB';
    return (coop?.initial as string | undefined) ?? `${(0).toFixed(precision)} ${symbol}`;
  }
}
