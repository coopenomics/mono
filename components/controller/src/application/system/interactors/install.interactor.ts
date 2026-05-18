import { Injectable, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import config from '~/config/config';
import logger from '~/config/logger';
import { RegistratorContract } from 'cooptypes';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { BLOCKCHAIN_PORT, BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import { generateUsername } from '~/utils/generate-username';
import { userStatus } from '~/types/user.types';
import { UserDomainEntity } from '~/domain/user/entities/user-domain.entity';
import type { CreateUserInputDomainInterface } from '~/domain/registration/interfaces/create-user-input-domain.interface';
import { HttpApiError } from '~/utils/httpApiError';
import httpStatus from 'http-status';
import { randomUUID } from 'crypto';
import { sha256 } from '~/utils/sha256';
import type { Cooperative } from 'cooptypes';
import type { InstallInputDomainInterface } from '~/domain/system/interfaces/install-input-domain.interface';
import { VARS_REPOSITORY, VarsRepository } from '~/domain/common/repositories/vars.repository';
import { MONO_STATUS_REPOSITORY, MonoStatusRepository } from '~/domain/common/repositories/mono-status.repository';
import { SystemStatus } from '~/application/system/dto/system-status.dto';
import { AccountDomainService, ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import { NovuWorkflowAdapter } from '~/infrastructure/novu/novu-workflow.adapter';
import { NOVU_WORKFLOW_PORT } from '~/domain/notification/interfaces/novu-workflow.port';
import type { WorkflowTriggerDomainInterface } from '~/domain/notification/interfaces/workflow-trigger-domain.interface';
import { Workflows } from '@coopenomics/notifications';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { normalizeUserEmail } from '~/utils/normalize-user-email';

@Injectable()
export class InstallInteractor {
  constructor(
    @Inject(VARS_REPOSITORY) private readonly varsRepository: VarsRepository,
    @Inject(MONO_STATUS_REPOSITORY) private readonly monoStatusRepository: MonoStatusRepository,
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
    @Inject(NOVU_WORKFLOW_PORT) private readonly novuWorkflowAdapter: NovuWorkflowAdapter,
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort,
    private readonly tokenApplicationService: TokenApplicationService,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService
  ) {}

  /**
   * Создает пользователя с соответствующими данными в генераторе документов
   */
  private async createUser(userBody: CreateUserInputDomainInterface) {
    userBody.email = normalizeUserEmail(userBody.email);
    // Проверяем на существование пользователя
    // допускаем обновление личных данных, если пользователь находится в статусе 'created'
    const exist = await this.userDomainService.findUserByEmail(userBody.email);

    if (exist && exist.status !== userStatus['1_Created']) {
      if (await this.userDomainService.isEmailTaken(userBody.email)) {
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

    // Создаем или обновляем пользователя в PostgreSQL
    if (exist) {
      // Обновляем существующего пользователя
      const updatedUser = await this.userDomainService.updateUserById(exist.id, userBody);
      return updatedUser;
    } else {
      // Создаем нового пользователя
      const newUser = await this.userDomainService.createUser(userBody);
      return newUser;
    }
  }

  async install(data: InstallInputDomainInterface): Promise<void> {
    const status = await this.monoStatusRepository.getStatus();

    // Разрешаем установку ТОЛЬКО если система в статусе 'initialized' (после initSystem)
    if (status !== SystemStatus.initialized) {
      throw new BadRequestException(
        `Установка невозможна. Текущий статус: ${status}. Требуется статус: ${SystemStatus.initialized}`
      );
    }

    const info = await this.blockchainPort.getInfo();
    const coop = await this.blockchainPort.getCooperative(config.coopname);

    if (!coop) throw new BadRequestException('Информация о кооперативе не обнаружена');

    const users = [] as UserDomainEntity[];
    const members = [] as any;
    const sovietExt = [] as any;
    const soviet = data.soviet;

    try {
      for (const member of soviet) {
        const username = generateUsername();
        sovietExt.push({ ...member, username });

        const addUser: RegistratorContract.Actions.AddUser.IAddUser = {
          coopname: config.coopname,
          referer: '',
          username,
          type: 'individual',
          created_at: info.head_block_time,
          initial: coop.initial,
          minimum: coop.minimum,
          spread_initial: false,
          meta: '',
          registration_hash: sha256(username),
        };

        await this.blockchainPort.addUser(addUser);

        const createUser: CreateUserInputDomainInterface = {
          email: member.individual_data.email,
          individual_data: member.individual_data,
          referer: '',
          role: 'user',
          type: 'individual',
          username,
        };

        const user = await this.createUser(createUser);
        // Обновляем статус пользователя на "зарегистрирован"
        await this.userDomainService.updateUserByUsername(username, {
          status: userStatus['4_Registered'],
          is_registered: true,
        });

        // Настраиваем подписчика уведомлений для члена совета
        try {
          await this.accountDomainService.setupNotificationSubscriber(username, 'члена совета');
        } catch (error: any) {
          logger.error(`Ошибка настройки подписчика NOVU для члена совета ${username}: ${error.message}`, error.stack);
        }

        // Добавляем в массив членов для отправки в блокчейн
        members.push({
          username: username,
          is_voting: true,
          position_title: member.role === 'chairman' ? 'Председатель совета' : 'Член совета',
          position: member.role,
        });

        users.push(user);
      }

      // Лаг p2p-репликации на не-producer nodeos (например на dev-loop'е
      // partner-coopback соединён со своим p2p-репликой) — после accept'а
      // adduser в local state может ещё не быть soviet::participants[N]
      // к моменту push'а createBoard. Контракт soviet::createboard падает
      // «Один из аккаунтов не найден в реестре пайщиков». 2с гарантированно
      // перекрывают prod-задержку (~50ms) и dev-loop (1-3с).
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Создаём доску совета
      await this.blockchainPort.createBoard({
        coopname: config.coopname,
        username: config.coopname,
        type: 'soviet',
        members: members,
        name: 'Совет',
        description: '',
      });

      // Отправляем приглашения только после успешного создания совета
      for (const member of sovietExt) {
        const inviteEmail = normalizeUserEmail(member.individual_data.email);
        const user = await this.userDomainService.getUserByEmail(inviteEmail);
        if (!user) {
          throw new Error(`Пользователь с email ${inviteEmail} не найден`);
        }
        const subscriberId = user.subscriber_id?.trim();
        if (!subscriberId) {
          throw new Error(
            `subscriber_id не задан для пользователя ${user.username} — нельзя отправить приглашение через Novu`
          );
        }
        const token = await this.tokenApplicationService.generateInviteToken(inviteEmail, user.id);
        const inviteUrl = `${config.frontend_url}/${config.coopname}/auth/invite?token=${token}`;

        const payload: Workflows.Invite.IPayload = {
          inviteUrl,
        };

        const triggerData: WorkflowTriggerDomainInterface = {
          name: Workflows.Invite.id,
          to: {
            subscriberId,
            email: inviteEmail,
          },
          payload,
        };

        await this.novuWorkflowAdapter.triggerWorkflow(triggerData);
      }
    } catch (e: any) {
      // Откат изменений в случае ошибки
      for (const user of users) {
        await this.userDomainService.deleteUserByUsername(user.username);
        await this.generatorPort.del('individual', { username: user.username });
      }
      throw new BadRequestException(e.message);
    }

    // Сохраняем переменные кооператива
    await this.varsRepository.create(data.vars);

    // Обновляем статус на активный
    await this.monoStatusRepository.setStatus(SystemStatus.active);

    // Проверяем, что статус действительно обновился
    const updatedStatus = await this.monoStatusRepository.getStatus();
    if (updatedStatus !== SystemStatus.active) {
      throw new BadRequestException('Не удалось обновить статус системы');
    }

    logger.info('Система установлена');
  }
}
