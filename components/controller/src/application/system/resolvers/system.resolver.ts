import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { SystemInfoDTO } from '../dto/system.dto';
import { SystemService } from '../services/system.service';
import { InstallDTO } from '../dto/install.dto';
import { InitDTO } from '../dto/init.dto';
import { SetWifInputDTO } from '../dto/set-wif-input.dto';
import { UpdateDTO } from '../dto/update.dto';
import { SettingsDTO, UpdateSettingsInputDTO } from '../dto/settings.dto';
import { StartInstallInputDTO } from '../dto/start-install-input.dto';
import { StartInstallResultDTO } from '../dto/start-install-result.dto';
import { GetInstallationStatusInputDTO, InstallationStatusDTO } from '../dto/installation-status.dto';
import { RegistrationConfigDTO } from '../dto/registration-config.dto';
import { AuthRoles } from '@coopenomics/extension-kit';
import { AccountType } from '~/application/account/enum/account-type.enum';

@Resolver(() => SystemInfoDTO)
export class SystemResolver {
  constructor(private readonly systemService: SystemService) {}

  @Query(() => SystemInfoDTO, {
    name: 'getSystemInfo',
    description: 'Получить сводную публичную информацию о системе',
  })
  async getSystemInfo(): Promise<SystemInfoDTO> {
    return this.systemService.getInfo();
  }

  @Mutation(() => StartInstallResultDTO, {
    name: 'startInstall',
    description: 'Начать процесс установки кооператива, установить ключ и получить код установки',
  })
  async startInstall(
    @Args('data', { type: () => StartInstallInputDTO })
    data: StartInstallInputDTO
  ): Promise<StartInstallResultDTO> {
    return this.systemService.startInstall(data);
  }

  @Query(() => InstallationStatusDTO, {
    name: 'getInstallationStatus',
    description: 'Получить статус установки кооператива с приватными данными',
  })
  async getInstallationStatus(
    @Args('data', { type: () => GetInstallationStatusInputDTO })
    data: GetInstallationStatusInputDTO
  ): Promise<InstallationStatusDTO> {
    return this.systemService.getInstallationStatus(data);
  }

  @Mutation(() => SystemInfoDTO, {
    name: 'updateSystem',
    description: 'Обновить параметры системы',
  })
  @AuthRoles(['chairman'])
  async update(
    @Args('data', { type: () => UpdateDTO })
    data: UpdateDTO
  ): Promise<SystemInfoDTO> {
    return this.systemService.update(data);
  }

  @Mutation(() => SystemInfoDTO, {
    name: 'installSystem',
    description: 'Произвести установку членов совета перед началом работы',
  })
  async install(
    @Args('data', { type: () => InstallDTO })
    data: InstallDTO
  ): Promise<SystemInfoDTO> {
    return this.systemService.install(data);
  }

  @Mutation(() => SystemInfoDTO, {
    name: 'initSystem',
    description: 'Произвести инициализацию программного обеспечения перед установкой совета методом install',
  })
  async init(
    @Args('data', { type: () => InitDTO })
    data: InitDTO
  ): Promise<SystemInfoDTO> {
    return this.systemService.init(data);
  }

  @Mutation(() => Boolean, {
    name: 'setWif',
    description: 'Сохранить приватный ключ в зашифрованном серверном хранилище',
  })
  async setWif(
    @Args('data', { type: () => SetWifInputDTO })
    data: SetWifInputDTO
  ): Promise<boolean> {
    await this.systemService.setWif(data);
    return true;
  }

  @Mutation(() => SettingsDTO, {
    name: 'updateSettings',
    description: 'Обновить настройки системы (рабочие столы и маршруты по умолчанию)',
  })
  @AuthRoles(['chairman'])
  async updateSettings(
    @Args('data', { type: () => UpdateSettingsInputDTO })
    data: UpdateSettingsInputDTO
  ): Promise<SettingsDTO> {
    return this.systemService.updateSettings(data);
  }

  @Query(() => RegistrationConfigDTO, {
    name: 'getRegistrationConfig',
    description: 'Получить конфигурацию программ регистрации для кооператива',
  })
  async getRegistrationConfig(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('account_type', { type: () => AccountType }) accountType: AccountType
  ): Promise<RegistrationConfigDTO> {
    return this.systemService.getRegistrationConfig(coopname, accountType);
  }
}
