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
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { Workflows } from '@coopenomics/notifications';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { normalizeUserEmail } from '~/utils/normalize-user-email';

/** Минимум членов совета — как MIN_SOVIET_MEMBERS_COUNT в контракте soviet (3 prod / 1 dev). */
const MIN_SOVIET_MEMBERS_COUNT = config.min_soviet_members_count;

@Injectable()
export class InstallInteractor {
  constructor(
    @Inject(VARS_REPOSITORY) private readonly varsRepository: VarsRepository,
    @Inject(MONO_STATUS_REPOSITORY) private readonly monoStatusRepository: MonoStatusRepository,
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
    @Inject(NOTIFICATION_PORT) private readonly notificationPort: NotificationPort,
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
    const savedVars = await this.varsRepository.get();
    const isIncompleteInstallMaintenance =
      status === SystemStatus.maintenance && !savedVars?.name;

    // Разрешаем установку если:
    // - initialized (нормальный прогон)
    // - maintenance без сохранённых vars (прерванная установка, можно повторить)
    if (status !== SystemStatus.initialized && !isIncompleteInstallMaintenance) {
      throw new BadRequestException(
        `Установка невозможна. Текущий статус: ${status}. Требуется статус: ${SystemStatus.initialized}`
      );
    }

    if (data.soviet.length < MIN_SOVIET_MEMBERS_COUNT) {
      throw new BadRequestException(
        `Количество членов совета должно быть не менее ${MIN_SOVIET_MEMBERS_COUNT}`
      );
    }

    // Повтор после прерванной установки: снимаем maintenance, дальше — обычный прогон.
    if (isIncompleteInstallMaintenance) {
      await this.monoStatusRepository.setStatus(SystemStatus.initialized);
    }

    const info = await this.blockchainPort.getInfo();
    const coop = await this.blockchainPort.getCooperative(config.coopname);

    if (!coop) throw new BadRequestException('Информация о кооперативе не обнаружена');

    // ВНИМАНИЕ про лок установки: статус НЕ трогаем здесь, до цикла. Раньше тут
    // стоял setStatus(maintenance), но 'maintenance' на фронте включает
    // полноэкранную заглушку «Техническое обслуживание» (watch-desktop-health),
    // которая накрыла бы саму страницу установки во время нормального прогона.
    // Поэтому статус остаётся 'initialized' на всё время установки (фронт
    // показывает страницу install, как и прежде), а в 'maintenance' переводим
    // ТОЛЬКО в catch при падении ПОСЛЕ записи в цепь — это блокирует повторный
    // запуск install (guard выше требует 'initialized') и корректно сигналит,
    // что коопа в полу-установленном состоянии и требует ручного разбора.
    // Так на gorozhane (fgrtejiwnynn) образовались дубли: install падал после
    // adduser, статус оставался 'initialized', повторный запуск проходил guard
    // и заново минтил аккаунты совета (инцидент 2026-06-04).

    const users = [] as UserDomainEntity[];
    const members = [] as any;
    const sovietExt = [] as any;
    const soviet = data.soviet;

    // Флаг необратимого следа: стал true после первой успешной on-chain
    // регистрации (adduser). On-chain операции откатить нельзя, поэтому при
    // ошибке ПОСЛЕ этого момента off-chain rollback НЕ делаем — иначе теряется
    // привязка личность↔username, нужная для последующей сверки/очистки.
    let chainWriteHappened = false;

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
        // С этого момента на цепи есть необратимый аккаунт + оплаченный паевой.
        chainWriteHappened = true;

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
          logger.error(`Ошибка настройки identity получателя для члена совета ${username}: ${error.message}`, error.stack);
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
            `subscriber_id не задан для пользователя ${user.username} — нельзя отправить приглашение`
          );
        }
        const token = await this.tokenApplicationService.generateInviteToken(inviteEmail, user.id);
        const inviteUrl = `${config.frontend_url}/${config.coopname}/auth/invite?token=${token}`;

        const payload: Workflows.Invite.IPayload = {
          inviteUrl,
        };

        await this.notificationPort.notify({
          coopname: config.coopname,
          workflowId: Workflows.Invite.id,
          to: {
            subscriberId,
            email: inviteEmail,
            username: user.username,
          },
          payload,
        });
      }
    } catch (e: any) {
      if (chainWriteHappened) {
        // На цепи уже созданы аккаунты пайщиков (откату не подлежат). НЕ удаляем
        // off-chain записи — сохраняем привязку личность↔username для ручной
        // сверки/очистки. Переводим систему в 'maintenance': повторный запуск
        // install заблокирован (guard требует 'initialized'), фронт показывает
        // заглушку техобслуживания (коопа в полу-установленном состоянии);
        // сначала нужно вручную доустановить или вычистить частично созданное.
        await this.monoStatusRepository.setStatus(SystemStatus.maintenance);
        logger.error(
          `Установка прервана ПОСЛЕ on-chain регистрации (${users.length} аккаунтов уже на цепи): ${e.message}. ` +
            `Система переведена в '${SystemStatus.maintenance}'. Off-chain данные сохранены для ручного разбора. ` +
            `Повторный install заблокирован до очистки/доустановки.`,
          e.stack
        );
        throw new BadRequestException(
          `Установка прервана после создания аккаунтов на цепи: ${e.message}. Требуется ручной разбор (статус '${SystemStatus.maintenance}').`
        );
      }

      // On-chain след отсутствует — безопасно откатываем off-chain и
      // возвращаем 'initialized', чтобы установку можно было повторить чисто.
      for (const user of users) {
        await this.userDomainService.deleteUserByUsername(user.username);
        await this.generatorPort.del('individual', { username: user.username });
      }
      await this.monoStatusRepository.setStatus(SystemStatus.initialized);
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
