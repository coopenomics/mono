import { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';
import config from '~/config/config';
import { AccountDomainService } from '~/domain/account/services/account-domain.service';
import { Inject, Injectable, Logger, HttpStatus } from '@nestjs/common';
import { HttpApiError } from '~/utils/httpApiError';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import { EventsService } from '~/infrastructure/events/events.service';
import type { GetAccountsInputDomainInterface } from '~/domain/account/interfaces/get-accounts-input.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { RegisterAccountDomainInterface } from '~/domain/account/interfaces/register-account-input.interface';
import type { RegisteredAccountDomainInterface } from '~/domain/account/interfaces/registeted-account.interface';
import type { UpdateAccountDomainInterface } from '~/domain/account/interfaces/update-account-input.interface';
import { AccountType } from '~/application/account/enum/account-type.enum';
import httpStatus from 'http-status';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { randomUUID } from 'crypto';
import type { Cooperative } from 'cooptypes';
import { ORGANIZATION_REPOSITORY, OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { INDIVIDUAL_REPOSITORY, IndividualRepository } from '~/domain/common/repositories/individual.repository';
import { ENTREPRENEUR_REPOSITORY, EntrepreneurRepository } from '~/domain/common/repositories/entrepreneur.repository';
import {
  SEARCH_PRIVATE_ACCOUNTS_REPOSITORY,
  SearchPrivateAccountsRepository,
} from '~/domain/common/repositories/search-private-accounts.repository';
import { IndividualDomainEntity } from '~/domain/branch/entities/individual-domain.entity';
import { OrganizationDomainEntity } from '~/domain/branch/entities/organization-domain.entity';
import { EntrepreneurDomainEntity } from '~/domain/branch/entities/entrepreneur-domain.entity';
import { ACCOUNT_BLOCKCHAIN_PORT, AccountBlockchainPort } from '~/domain/account/interfaces/account-blockchain.port';
import { CANDIDATE_REPOSITORY, CandidateRepository } from '~/domain/account/repository/candidate.repository';
import { userStatus } from '~/types/user.types';
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { CandidateStatus } from '~/domain/registration/enum';
import { sha256 } from '~/utils/sha256';
import { registrationProfileFingerprint } from '~/utils/registration-profile-fingerprint';
import { normalizeUserEmail } from '~/utils/normalize-user-email';
import type {
  SearchPrivateAccountsInputDomainInterface,
  PrivateAccountSearchResultDomainInterface,
} from '~/domain/common/interfaces/search-private-accounts-domain.interface';

@Injectable()
export class AccountInteractor {
  constructor(
    private readonly accountDomainService: AccountDomainService,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(INDIVIDUAL_REPOSITORY) private readonly individualRepository: IndividualRepository,
    @Inject(ENTREPRENEUR_REPOSITORY) private readonly entrepreneurRepository: EntrepreneurRepository,
    @Inject(SEARCH_PRIVATE_ACCOUNTS_REPOSITORY)
    private readonly searchPrivateAccountsRepository: SearchPrivateAccountsRepository,
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
    @Inject(CANDIDATE_REPOSITORY) private readonly candidateRepository: CandidateRepository,
    private readonly eventsService: EventsService,
    @Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort,
    private readonly tokenApplicationService: TokenApplicationService,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository
  ) {}

  private readonly logger = new Logger(AccountInteractor.name);

  /**
   * Создает пользователя с соответствующими данными в генераторе документов
   */
  private async createUser(userBody: any) {
    userBody.email = normalizeUserEmail(userBody.email);
    // Проверяем на существование пользователя
    // допускаем обновление личных данных, если пользователь находится в статусе 'created'
    const exist = await this.userRepository.findByEmail(userBody.email);

    if (exist && exist.status !== 'created') {
      if (await this.userRepository.isEmailTaken(userBody.email)) {
        throw new HttpApiError(httpStatus.BAD_REQUEST, 'Пользователь с указанным EMAIL уже зарегистрирован');
      }
    }

    // Валидация входных данных
    if (userBody.type === 'individual') {
      if (!userBody.individual_data) throw new HttpApiError(httpStatus.BAD_REQUEST, 'Individual data is required');
      else userBody.individual_data.email = userBody.email;
    }

    if (userBody.type === 'organization') {
      if (!userBody.organization_data) throw new HttpApiError(httpStatus.BAD_REQUEST, 'Organization data is required');
      else userBody.organization_data.email = userBody.email;
    }

    if (userBody.type === 'entrepreneur') {
      if (!userBody.entrepreneur_data) throw new HttpApiError(httpStatus.BAD_REQUEST, 'Entrepreneur data is required');
      else userBody.entrepreneur_data.email = userBody.email;
    }

    // Сохраняем данные в соответствующие коллекции генератора
    if (userBody.type === 'individual' && userBody.individual_data) {
      await this.generatorPort.save('individual', { username: userBody.username, ...userBody.individual_data });
    }

    if (userBody.type === 'organization' && userBody.organization_data) {
      const { bank_account, ...userData } = userBody.organization_data || {};

      const paymentMethod: Cooperative.Payments.IPaymentData = {
        username: userBody.username,
        method_id: randomUUID(),
        method_type: 'bank_transfer',
        is_default: true,
        data: bank_account,
      };

      await this.generatorPort.save('organization', { username: userBody.username, ...userData });
      await this.generatorPort.save('paymentMethod', paymentMethod);
    }

    if (userBody.type === 'entrepreneur' && userBody.entrepreneur_data) {
      const { bank_account, ...userData } = userBody.entrepreneur_data || {};

      const paymentMethod: Cooperative.Payments.IPaymentData = {
        username: userBody.username,
        method_id: randomUUID(),
        method_type: 'bank_transfer',
        is_default: true,
        data: bank_account,
      };

      await this.generatorPort.save('entrepreneur', { username: userBody.username, ...userData });
      await this.generatorPort.save('paymentMethod', paymentMethod);
    }
    console.log('userBody', userBody);
    console.log('exist', exist);
    // Создаем или обновляем пользователя
    if (exist) {
      const updatedUser = await this.userRepository.updateByUsername(exist.username, userBody);
      console.log('updatedUser', updatedUser);
      if (!updatedUser) throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
      return updatedUser;
    } else {
      return await this.userRepository.create(userBody);
    }
  }

  async updateAccount(data: UpdateAccountDomainInterface): Promise<AccountDomainEntity> {
    this.logger.log(`Начало обновления аккаунта ${data.username}`);

    let user;
    if (data.individual_data) {
      const email = normalizeUserEmail(data.individual_data.email);
      user = await this.userRepository.updateByUsername(data.username, { email });
      if (!user) throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
      this.individualRepository.create({ ...data.individual_data, email, username: data.username });
    } else if (data.organization_data) {
      const email = normalizeUserEmail(data.organization_data.email);
      user = await this.userRepository.updateByUsername(data.username, { email });
      if (!user) throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
      this.organizationRepository.create({ ...data.organization_data, email, username: data.username });
    } else if (data.entrepreneur_data) {
      const email = normalizeUserEmail(data.entrepreneur_data.email);
      user = await this.userRepository.updateByUsername(data.username, { email });
      if (!user) throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
      this.entrepreneurRepository.create({ ...data.entrepreneur_data, email, username: data.username });
    } else {
      throw new Error('Не получены входные данные для обновления');
    }

    // Получаем финальный аккаунт
    const account = await this.getAccount(user.username);

    this.logger.log(`Успешно обновлен аккаунт ${data.username}`);

    // Эмитим событие об обновлении аккаунта для синхронизации с участниками
    this.eventsService.emit('account::updated', {
      username: data.username,
      account,
    });

    const result = new AccountDomainEntity(account);
    return result;
  }

  /**
   * Удаление аккаунта из системы учёта провайдера (off-chain).
   *
   * deleteUserByUsername удаляет только строку users в PG — блокчейн не трогает.
   * Назначение — почистить реестр от незавершённых/отклонённых регистраций
   * (тестеры, брошенные попытки) и освободить занятый e-mail для перерегистрации.
   *
   * Единственный гард — НЕ принят в кооператив. participant_account
   * (accepted|blocked) появляется только после приёма советом, его наличие ⟺ член
   * кооператива. Всё остальное (черновик, заявление, оплачен/на рассмотрении
   * совета, отклонён, возврат) удаляемо — это и есть «незавершённая регистрация».
   *
   * Статус для гейта НЕ годится: воронка реально доходит лишь до `registered`
   * (отказ совета и возврат взноса оставляют статус `registered`, а `failed`/
   * `refunded` users.status никем не выставляются). Прежний allow-list
   * `[created, joined, payed, failed, refunded]` исключал именно отклонённые/
   * оплаченные брошенные регистрации — ровно те, ради которых задумана чистка.
   *
   * On-chain аккаунт заводится при оплате взноса (статус registered) и в EOSIO
   * неудаляем — остаётся осиротевшим, имя в цепи занято навсегда. Для
   * регистрационной чистки это приемлемо: off-chain учёт провайдера и цепь
   * намеренно расходятся (см. registration-decline.listener — карточку кандидата
   * на цепи снимает refundpay, системный аккаунт остаётся).
   */
  async deleteAccount(username: string): Promise<void> {
    const account = await this.accountDomainService.getAccount(username);

    if (account.participant_account) {
      throw new HttpApiError(
        HttpStatus.BAD_REQUEST,
        'Пайщик принят в кооператив — удаление невозможно.'
      );
    }

    await this.userDomainService.deleteUserByUsername(username);
  }

  async getUserProfile(
    username: string,
    accountType: AccountType
  ): Promise<IndividualDomainEntity | OrganizationDomainEntity | EntrepreneurDomainEntity> {
    switch (accountType) {
      case AccountType.individual:
        return new IndividualDomainEntity(await this.individualRepository.findByUsername(username));
      case AccountType.organization:
        return new OrganizationDomainEntity(await this.organizationRepository.findByUsername(username));
      case AccountType.entrepreneur:
        return new EntrepreneurDomainEntity(await this.entrepreneurRepository.findByUsername(username));
      default:
        throw new Error(`Неизвестный тип аккаунта: ${accountType}`);
    }
  }

  async registerAccount(data: RegisterAccountDomainInterface): Promise<RegisteredAccountDomainInterface> {
    //TODO refactor after migrate from mongo
    const user = await this.createUser({ ...data, role: 'user' });
    const tokens = await this.tokenApplicationService.generateAuthTokens(user.id);

    // Настраиваем identity получателя
    try {
      await this.accountDomainService.setupNotificationSubscriber(user.username, 'регистрации');
    } catch (error: any) {
      this.logger.error(`Ошибка настройки identity получателя при регистрации ${data.username}: ${error.message}`, error.stack);
    }

    // Создаем нового кандидата в репозитории
    const now = new Date();
    await this.candidateRepository.create({
      username: data.username,
      coopname: config.coopname,
      braname: '', // Может быть задано позже
      status: CandidateStatus.PENDING, // Начальный статус
      type: data.type, // Используем тип из входных данных
      created_at: now,
      documents: {
        statement: undefined, // Документы будут добавлены позже
        wallet_agreement: undefined,
        signature_agreement: undefined,
        privacy_agreement: undefined,
        user_agreement: undefined,
      },
      referer: data.referer,
      public_key: data.public_key,
      meta: JSON.stringify({}),
      registration_hash: sha256(data.username), // Будет установлен при обработке платежа
    });

    this.logger.log(`Создан новый кандидат: ${data.username}, тип: ${data.type}`);

    const account = await this.getAccount(data.username);

    const result: RegisteredAccountDomainInterface = {
      account,
      tokens,
    };

    return result;
  }

  async getAccount(username: string): Promise<AccountDomainEntity> {
    const account = await this.accountDomainService.getAccount(username);

    // Прокидываем сводку по вступительному платежу, чтобы фронт восстановил шаг
    // регистрации (ожидание/отклонение платежа) после перезагрузки и в любой вкладке.
    // Актуально только пока пайщик ещё не принят (нет participant_account).
    if (!account.participant_account) {
      const payment = await this.paymentRepository.findLatestByUsernameAndType(
        username,
        PaymentTypeEnum.REGISTRATION
      );
      // Отказ совета (declinereg) заводит исходящий возврат REGISTRATION_REFUND.
      // Сообщаем фронту отдельным статусом REFUNDED (входящий рег-платёж этот статус
      // никогда не принимает) — иначе экран ожидания висит на «ожидаем решение
      // совета», т.к. сам входящий платёж остаётся COMPLETED. Отказ относится к
      // ТЕКУЩЕМУ циклу только если возврат свежее последнего вступительного платежа:
      // после повторной подачи создаётся новый REGISTRATION (свежее старого возврата),
      // и прошлый отказ больше не всплывает.
      const refund = await this.paymentRepository.findLatestByUsernameAndType(
        username,
        PaymentTypeEnum.REGISTRATION_REFUND
      );
      const isCouncilDeclined =
        !!refund &&
        (!payment || new Date(refund.created_at).getTime() >= new Date(payment.created_at).getTime());

      if (isCouncilDeclined && refund) {
        // Два шага возврата для UI: пока касса не подтвердила исходящий платёж
        // (refund != COMPLETED) — PROCESSING (кнопки повторной подачи нет, аккаунт
        // на цепи ещё занят карточкой); после подтверждения — REFUNDED (refundpay
        // снял карточку, повторная подача возможна).
        const done = refund.status === PaymentStatusEnum.COMPLETED;
        account.registration_payment = {
          status: done ? PaymentStatusEnum.REFUNDED : PaymentStatusEnum.PROCESSING,
          message: done
            ? 'Совет отказал в приёме. Регистрационный взнос возвращён. Вы можете подать заявку заново.'
            : 'Совет отказал в приёме. Регистрационный взнос возвращается. Дождитесь его завершения, чтобы подать заявку заново.',
          hash: refund.hash,
          quantity: refund.quantity,
          symbol: refund.symbol,
        };
      } else if (payment) {
        account.registration_payment = {
          status: payment.status,
          message: payment.message ?? null,
          hash: payment.hash,
          quantity: payment.quantity,
          symbol: payment.symbol,
        };
      }
    }

    return account;
  }

  async getAccounts(
    data: GetAccountsInputDomainInterface = {},
    options: PaginationInputDomainInterface = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResultDomainInterface<AccountDomainEntity>> {
    const provider_accounts = await this.userRepository.findAllPaginated(data, options);

    const result: PaginationResultDomainInterface<AccountDomainEntity> = {
      items: [],
      totalCount: provider_accounts.totalCount,
      totalPages: provider_accounts.totalPages,
      currentPage: provider_accounts.currentPage,
    };

    for (const account of provider_accounts.items) {
      // this.getAccount (а не accountDomainService.getAccount) — чтобы реестр получил
      // registration_payment: иначе отказ совета (Registered + возврат взноса) на
      // списке неотличим от «ожидает совет». Обогащение стоит 2 доп. запроса к
      // платежам только для непринятых аккаунтов (гард `!participant_account`).
      const item = await this.getAccount(account.username);
      result.items.push(item);
    }

    return result;
  }

  /**
   * Регистрирует аккаунт в блокчейне.
   * @param username - Имя пользователя
   */
  async registerBlockchainAccount(username: string): Promise<void> {
    this.logger.log(`Начало регистрации аккаунта ${username} в блокчейне`);

    // Получаем кандидата из репозитория
    const candidate = await this.candidateRepository.findByUsername(username);
    if (!candidate) {
      throw new HttpApiError(HttpStatus.NOT_FOUND, `Кандидат с именем ${username} не найден`);
    }

    // Гард A (замок профиля): на цепь не должны уйти данные, отличные от
    // подписанных в заявлении. Если в meta кандидата зафиксирован отпечаток
    // (заявление подписано после внедрения гарда) — сверяем с текущим
    // профилем. Кандидаты без отпечатка (регистрация шла до внедрения)
    // пропускаются, чтобы не сломать уже идущие регистрации.
    let candidateMeta: Record<string, any> = {};
    try {
      candidateMeta = candidate.meta ? JSON.parse(candidate.meta) : {};
    } catch {
      candidateMeta = {};
    }
    const lockedFingerprint = candidateMeta?.registration_profile_fingerprint;
    if (lockedFingerprint) {
      const account = await this.accountDomainService.getAccount(username);
      const currentFingerprint = registrationProfileFingerprint(account?.private_account);
      if (currentFingerprint && currentFingerprint !== lockedFingerprint) {
        throw new HttpApiError(
          HttpStatus.BAD_REQUEST,
          'Данные пайщика изменены после подписания заявления. Пожалуйста, переподпишите заявление перед регистрацией.'
        );
      }
    }

    try {
      // Вызываем порт для регистрации в блокчейне, передавая объект кандидата целиком
      await this.accountBlockchainPort.registerBlockchainAccount(candidate);

      // Обновляем статус кандидата в базе данных
      await this.candidateRepository.update(username, {
        status: CandidateStatus.REGISTERED,
        registered_at: new Date(),
      });

      // Обновляем статус пользователя
      await this.userDomainService.updateUserByUsername(username, {
        status: userStatus['4_Registered'],
        is_registered: true,
        has_account: true,
      });

      this.logger.log(`Успешная регистрация аккаунта ${username} в блокчейне`);
    } catch (error: any) {
      this.logger.error(`Ошибка при регистрации аккаунта ${username} в блокчейне: ${error.message}`, error.stack);
      throw new HttpApiError(HttpStatus.INTERNAL_SERVER_ERROR, `Ошибка при регистрации в блокчейне: ${error.message}`);
    }
  }

  /**
   * Откат регистрации к редактированию данных (recovery drift/decline).
   *
   * Применим ТОЛЬКО до создания аккаунта в блокчейне: после reguser username
   * необратимо занят, и нужна перерегистрация — это отдельная ветка. Здесь же,
   * пока аккаунта в цепи нет, безопасно вернуть пайщика к началу:
   *  - снимаем заморозку профиля и e-mail (users.status → created);
   *  - сбрасываем кандидата (документы и отпечаток заявления), чтобы заявление
   *    пришлось переподписать под актуальные данные;
   *  - удаляем непринятую попытку регистрационного платежа, чтобы экран
   *    ожидания не показывал старый отказ.
   *
   * Если средства уже приняты (PAID/COMPLETED) — откат запрещён: нужен возврат
   * средств (отдельная ветка refund).
   */
  async resetRegistration(username: string): Promise<AccountDomainEntity> {
    const user = await this.userDomainService.getUserByUsername(username);
    if (!user) {
      throw new HttpApiError(HttpStatus.NOT_FOUND, `Пользователь ${username} не найден`);
    }

    // Повторная подача после отказа совета (вариант 1): в отличие от обычного
    // отката (до приёма платежа), здесь аккаунт уже в блокчейне и взнос был принят —
    // это нормально. Карточку участника на цепи снимает refundpay при завершении
    // возврата, поэтому пускаем только когда возврат COMPLETED (иначе повторный
    // reguser упадёт «повторное получение невозможно»). Отказ относится к текущему
    // циклу, только если возврат свежее последнего вступительного платежа.
    const payment = await this.paymentRepository.findLatestByUsernameAndType(
      username,
      PaymentTypeEnum.REGISTRATION
    );
    const refund = await this.paymentRepository.findLatestByUsernameAndType(
      username,
      PaymentTypeEnum.REGISTRATION_REFUND
    );
    const isCouncilDeclined =
      !!refund &&
      (!payment || new Date(refund.created_at).getTime() >= new Date(payment.created_at).getTime());

    if (isCouncilDeclined && refund) {
      if (refund.status !== PaymentStatusEnum.COMPLETED) {
        throw new HttpApiError(
          HttpStatus.BAD_REQUEST,
          'Возврат регистрационного взноса ещё выполняется. Подайте заявку заново после его завершения.'
        );
      }
      // Старые платежи не удаляем: getAccount различает циклы по дате — новый
      // вступительный платёж будет свежее этого возврата, и прошлый отказ исчезнет.
    } else {
      // Обычный откат до приёма платежа: аккаунт ещё не в блокчейне, взнос не принят.
      const blockchainAccount = await this.accountDomainService.getBlockchainAccount(username);
      if (
        blockchainAccount ||
        user.status === userStatus['4_Registered'] ||
        user.status === userStatus['5_Active']
      ) {
        throw new HttpApiError(
          HttpStatus.BAD_REQUEST,
          'Регистрация уже отправлена в блокчейн — откат к редактированию невозможен, требуется перерегистрация.'
        );
      }
      if (payment) {
        if (payment.status === PaymentStatusEnum.PAID || payment.status === PaymentStatusEnum.COMPLETED) {
          throw new HttpApiError(
            HttpStatus.BAD_REQUEST,
            'Вступительный взнос уже принят — для отката требуется возврат средств.'
          );
        }
        if (payment.id) {
          await this.paymentRepository.delete(payment.id);
        }
      }
    }

    // Кандидат: чистим документы и отпечаток заявления (потребуется переподпись).
    const candidate = await this.candidateRepository.findByUsername(username);
    if (candidate) {
      let candidateMeta: Record<string, any> = {};
      try {
        candidateMeta = candidate.meta ? JSON.parse(candidate.meta) : {};
      } catch {
        candidateMeta = {};
      }
      delete candidateMeta.registration_profile_fingerprint;
      await this.candidateRepository.update(username, {
        status: CandidateStatus.PENDING,
        documents: {},
        meta: JSON.stringify(candidateMeta),
      });
    }

    // Снимаем заморозку: профиль и e-mail снова можно менять.
    await this.userDomainService.updateUserByUsername(username, {
      status: userStatus['1_Created'],
      is_registered: false,
      has_account: false,
    });

    this.logger.log(`Регистрация ${username} откатана к редактированию данных`);

    return await this.accountDomainService.getAccount(username);
  }

  /**
   * Поиск приватных аккаунтов по запросу
   * @param input Входные данные для поиска
   * @returns Массив результатов поиска
   */
  async searchPrivateAccounts(
    input: SearchPrivateAccountsInputDomainInterface
  ): Promise<PrivateAccountSearchResultDomainInterface[]> {
    this.logger.log(`Поиск приватных аккаунтов по запросу: "${input.query}"`);

    const results = await this.searchPrivateAccountsRepository.searchPrivateAccounts(input);

    this.logger.log(`Найдено ${results.length} приватных аккаунтов`);

    return results;
  }

  /**
   * Получить отображаемое имя пользователя
   * @param username Имя пользователя
   * @returns Отображаемое имя (ФИО или название организации)
   */
  async getDisplayName(username: string): Promise<string> {
    return await this.accountDomainService.getDisplayName(username);
  }
}
