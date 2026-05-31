import { Inject, Injectable, Logger } from '@nestjs/common';
import { SYSTEM_BLOCKCHAIN_PORT, SystemBlockchainPort } from '~/domain/system/interfaces/system-blockchain.port';
import { SystemInfoDomainEntity } from '~/domain/system/entities/systeminfo-domain.entity';
import config from '~/config/config';
import type { RegistratorContract } from 'cooptypes';
import type { BlockchainAccountInterface } from '~/types/shared';
import { randomUUID } from 'crypto';
import { AccountDomainService } from '~/domain/account/services/account-domain.service';
import type { InstallInputDomainInterface } from '~/domain/system/interfaces/install-input-domain.interface';
import type { InitInputDomainInterface } from '~/domain/system/interfaces/init-input-domain.interface';
import type { SetWifInputDomainInterface } from '~/domain/system/interfaces/set-wif-input-domain.interface';
import type {
  StartInstallInputDomainInterface,
  StartInstallResultDomainInterface,
} from '~/domain/system/interfaces/start-install-input-domain.interface';
import type {
  GetInstallationStatusInputDomainInterface,
  InstallationStatusDomainInterface,
} from '~/domain/system/interfaces/installation-status-domain.interface';
import { VARS_REPOSITORY, VarsRepository } from '~/domain/common/repositories/vars.repository';
import type { UpdateInputDomainInterface } from '~/domain/system/interfaces/update-input-domain.interface';
import { ORGANIZATION_REPOSITORY, type OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { SymbolsDTO } from '~/application/system/dto/symbols.dto';
import { SystemStatus } from '~/application/system/dto/system-status.dto';
import { SETTINGS_DOMAIN_PORT, SettingsDomainPort } from '~/domain/settings/ports/settings-domain.port';
import type { UpdateSettingsInputDomainInterface } from '~/domain/settings/interfaces/update-settings-input-domain.interface';
import type { SettingsDomainEntity } from '~/domain/settings/entities/settings-domain.entity';
import { InstallInteractor } from './install.interactor';
import { InitInteractor } from './init.interactor';
import { WifInteractor } from './wif.interactor';
import { MONO_STATUS_REPOSITORY, MonoStatusRepository } from '~/domain/common/repositories/mono-status.repository';
import type { BoardMemberDomainInterface } from '~/domain/system/interfaces/board-member-domain.interface';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import {
  PAYMENT_METHOD_DOMAIN_PORT,
  PaymentMethodDomainPort,
} from '~/domain/payment-method/ports/payment-method-domain.port';
import { LoadContactsInteractor } from './load-contacts.interactor';

@Injectable()
export class SystemInteractor {
  private readonly logger = new Logger(SystemInteractor.name);

  constructor(
    private readonly accountDomainService: AccountDomainService,
    @Inject(SYSTEM_BLOCKCHAIN_PORT) private readonly systemBlockchainPort: SystemBlockchainPort,
    private readonly loadContactsInteractor: LoadContactsInteractor,
    @Inject(VARS_REPOSITORY) private readonly varsRepository: VarsRepository,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(SETTINGS_DOMAIN_PORT) private readonly settingsDomainPort: SettingsDomainPort,
    private readonly installInteractor: InstallInteractor,
    private readonly initInteractor: InitInteractor,
    private readonly wifInteractor: WifInteractor,
    @Inject(MONO_STATUS_REPOSITORY) private readonly monoStatusRepository: MonoStatusRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PAYMENT_METHOD_DOMAIN_PORT) private readonly paymentMethodDomainPort: PaymentMethodDomainPort
  ) {}

  async startInstall(data: StartInstallInputDomainInterface): Promise<StartInstallResultDomainInterface> {
    const existingMono = await this.monoStatusRepository.getMonoDocument();

    // Разрешаем startInstall если:
    // 1. Документ mono не существует (первый запуск)
    // 2. Статус 'install' (повторный вызов)
    // 3. Статус 'initialized' (предустановка через server_secret уже выполнена, теперь устанавливаем ключ)
    if (existingMono && existingMono.status) {
      if (existingMono.status !== SystemStatus.install && existingMono.status !== SystemStatus.initialized) {
        throw new Error('Установка ключа невозможна. Система находится в статусе: ' + existingMono.status);
      }
    }

    // Проверяем и устанавливаем приватный ключ в vault
    await this.wifInteractor.setWif({
      username: config.coopname,
      wif: data.wif,
      permission: 'active',
    });

    // Если есть валидный код установки - возвращаем его
    if (existingMono?.install_code && existingMono.install_code_expires_at > new Date()) {
      return {
        install_code: existingMono.install_code,
        coopname: config.coopname,
      };
    }

    // Генерируем код установки (простой UUID)
    const installCode = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

    // Сохраняем код в БД и устанавливаем статус install
    await this.monoStatusRepository.setInstallCode(installCode, expiresAt);

    // Устанавливаем статус 'install' только если он еще не 'initialized' и не 'active'
    // (если была предустановка через server_secret или boot, статус уже установлен и мы его не меняем)
    if (!existingMono || (existingMono.status !== SystemStatus.initialized && existingMono.status !== SystemStatus.active)) {
      await this.monoStatusRepository.setStatus(SystemStatus.install);
    }

    return {
      install_code: installCode,
      coopname: config.coopname,
    };
  }

  async getInstallationStatus(data: GetInstallationStatusInputDomainInterface): Promise<InstallationStatusDomainInterface> {
    // Проверяем валидность кода установки
    const isValidCode = await this.monoStatusRepository.validateInstallCode(data.install_code);
    if (!isValidCode) {
      throw new Error('Неверный или истекший код установки');
    }

    // Получаем mono документ для получения дополнительных данных
    const monoDoc = await this.monoStatusRepository.getMonoDocument();

    try {
      // Получаем аккаунт кооператива
      const account = await this.accountDomainService.getAccount(config.coopname);

      // Получаем данные организации если они есть
      let organization_data: any = null;
      try {
        organization_data = await this.organizationRepository.findByUsername(config.coopname);
      } catch (error) {
        // Организация не найдена - нормально
      }

      return {
        has_private_account: !!account.private_account,
        private_account: account.private_account,
        init_by_server: monoDoc?.init_by_server || false,
        organization_data,
      };
    } catch (error) {
      // Если организация не найдена, возвращаем что приватных данных нет
      return {
        has_private_account: false,
        private_account: null,
        init_by_server: monoDoc?.init_by_server || false,
        organization_data: null,
      };
    }
  }

  async getDefaultPaymentMethod(username: string): Promise<any> {
    return await this.paymentMethodDomainPort.getDefaultPaymentMethod(username);
  }

  async setWif(data: SetWifInputDomainInterface): Promise<void> {
    await this.wifInteractor.setWif(data);
  }

  async init(data: InitInputDomainInterface): Promise<SystemInfoDomainEntity> {
    await this.initInteractor.init(data);
    return this.getInfo();
  }

  async install(data: InstallInputDomainInterface): Promise<SystemInfoDomainEntity> {
    // Выполняем установку совета и переменных
    await this.installInteractor.install(data);

    // Получаем обновленную информацию системы
    const systemInfo = await this.getInfo();

    // Проверяем, что статус действительно изменился на активный
    if (systemInfo.system_status !== SystemStatus.active) {
      throw new Error('Система не была правильно установлена: статус не изменился на активный');
    }

    return systemInfo;
  }

  async update(data: UpdateInputDomainInterface): Promise<SystemInfoDomainEntity> {
    if (data.vars) await this.varsRepository.create(data.vars);
    if (data.organization_data) await this.organizationRepository.create(data.organization_data);

    return this.getInfo();
  }

  async getInfo(): Promise<SystemInfoDomainEntity> {
    const blockchain_info = await this.systemBlockchainPort.getInfo(config.coopname);

    const cooperator_account = (await this.accountDomainService.getCooperatorAccount(
      config.coopname
    )) as RegistratorContract.Tables.Cooperatives.ICooperative;

    const user_account = (await this.accountDomainService.getUserAccount(
      config.coopname
    )) as RegistratorContract.Tables.Accounts.IAccount;

    const blockchain_account = (await this.accountDomainService.getBlockchainAccount(
      config.coopname
    )) as BlockchainAccountInterface;

    const system_status = (await this.monoStatusRepository.getStatus()) || 'install';

    let contacts;

    try {
      contacts = await this.loadContactsInteractor.execute();
      // eslint-disable-next-line no-empty
    } catch (e) {
      this.logger.warn(`Загрузка контактов завершилась ошибкой `);
      console.log(e)
    }

    const vars = await this.varsRepository.get();

    const symbols = new SymbolsDTO(
      config.blockchain.root_symbol,
      config.blockchain.root_govern_symbol,
      config.blockchain.root_precision,
      config.blockchain.root_govern_precision
    );

    // Получаем настройки системы
    const settings = await this.getSettings();

    // Получаем информацию о членах совета
    const board_members = await this.getBoardMembers();

    return new SystemInfoDomainEntity({
      blockchain_info,
      contacts,
      vars,
      coopname: config.coopname,
      cooperator_account,
      user_account,
      blockchain_account,
      system_status,
      symbols,
      settings,
      is_unioned: config.union.is_unioned,
      union_link: config.union.link,
      board_members,
      features: {
        // Поиск по документам теперь на PG-реестре подписанных документов (C28-21) — доступен всегда.
        search: true,
      },
    });
  }

  /**
   * Получает настройки системы
   */
  async getSettings(): Promise<SettingsDomainEntity> {
    return this.settingsDomainPort.getSettings();
  }

  /**
   * Получает информацию о членах совета кооператива
   */
  private async getBoardMembers(): Promise<BoardMemberDomainInterface[]> {
    try {
      // Получаем всех пользователей с ролями member и chairman
      const boardUsers = await this.userRepository.findByRoles(['member', 'chairman']);

      if (boardUsers.length === 0) {
        return [];
      }

      // Параллельно получаем информацию о каждом пользователе через getAccount
      const boardMemberPromises = boardUsers.map(async (user) => {
        try {
          const account = await this.accountDomainService.getAccount(user.username);

          // Проверяем, что у пользователя есть приватный аккаунт типа individual
          if (
            !account.private_account ||
            account.private_account.type !== 'individual' ||
            !account.private_account.individual_data
          ) {
            this.logger.warn(`User ${user.username} with role ${user.role} is not an individual or has no individual data`);
            return null;
          }

          const { first_name, last_name, middle_name } = account.private_account.individual_data;

          return {
            username: user.username,
            first_name,
            last_name,
            middle_name,
            is_chairman: user.role === 'chairman',
          } as BoardMemberDomainInterface;
        } catch (error: any) {
          this.logger.error(`Failed to get account info for user ${user.username}: ${error.message}`);
          return null;
        }
      });

      // Ждем завершения всех параллельных запросов
      const boardMembers = await Promise.all(boardMemberPromises);

      // Фильтруем null значения (пользователи без данных)
      return boardMembers.filter((member): member is BoardMemberDomainInterface => member !== null);
    } catch (error: any) {
      this.logger.error(`Failed to get board members: ${error.message}`);
      return [];
    }
  }

  /**
   * Обновляет настройки системы
   * @param updates - объект с полями для обновления
   */
  async updateSettings(updates: UpdateSettingsInputDomainInterface): Promise<SettingsDomainEntity> {
    return this.settingsDomainPort.updateSettings(updates);
  }
}
