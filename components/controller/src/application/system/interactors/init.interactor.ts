import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import config from '~/config/config';
import logger from '~/config/logger';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import type { InitInputDomainInterface } from '~/domain/system/interfaces/init-input-domain.interface';
import { ORGANIZATION_REPOSITORY, OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { MONO_STATUS_REPOSITORY, MonoStatusRepository } from '~/domain/common/repositories/mono-status.repository';
import { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import { SystemStatus } from '~/application/system/dto/system-status.dto';

@Injectable()
export class InitInteractor {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(MONO_STATUS_REPOSITORY) private readonly monoStatusRepository: MonoStatusRepository,
    @Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort
  ) {}

  async init(data: InitInputDomainInterface): Promise<void> {
    const existingMono = await this.monoStatusRepository.getMonoDocument();

    // Разрешаем инициализацию если установка еще не завершена (статус !== 'active')
    if (existingMono && (existingMono.status === SystemStatus.active || existingMono.status === SystemStatus.maintenance)) {
      throw new BadRequestException(
        `Инициализация невозможна - установка уже завершена. Система находится в статусе '${existingMono.status}'. `
      );
    }

    // Определяем тип инициализации:
    // - Если data.is_server_init === true (вызов от провайдера через server-secret) — ВСЕГДА серверная.
    //   Это разблокирует перезапись user-init данных провайдером при следующем initSystem.
    // - Иначе сохраняем прежнюю логику: первая инициализация = серверная, повторная — наследует флаг.
    const isServerInit = data.is_server_init === true
      ? true
      : !existingMono
        ? true
        : existingMono.init_by_server === true;

    // Проверяем права на обновление:
    // Пользователь не может обновлять данные, установленные сервером
    if (existingMono && existingMono.init_by_server === true && !isServerInit) {
      throw new BadRequestException(
        'Невозможно обновить данные организации - они были установлены администратором и доступны только для чтения.'
      );
    }

    const { bank_account, ...organization } = data.organization_data;

    // Обновляем или создаем платежный метод
    const paymentMethod = new PaymentMethodDomainEntity({
      username: config.coopname,
      method_id: `${config.coopname}_bank`, // Фиксированный ID для возможности обновления
      method_type: 'bank_transfer',
      data: bank_account,
      is_default: true,
    });

    await this.generatorPort.save('paymentMethod', paymentMethod);

    // Устанавливаем статус системы - инициализирована (если он еще не установлен)
    if (!existingMono || existingMono.status !== SystemStatus.initialized) {
      await this.monoStatusRepository.setStatus(SystemStatus.initialized);
    }

    // Устанавливаем флаг источника инициализации:
    // - Первая инициализация: ставим isServerInit как есть (true для server-side, true для user-side при первом init — историческое поведение).
    // - Повторная: если is_server_init=true пришёл от провайдера — поднимаем флаг в true (даже если до этого было user-init).
    //   Это нужно чтобы провайдер мог перезаписать данные после того как пользователь успел заполнить форму первым.
    if (!existingMono || data.is_server_init === true) {
      await this.monoStatusRepository.setInitByServer(isServerInit);
    }

    // Сохраняем данные организации (create перезапишет если уже существует)
    await this.organizationRepository.create({ username: config.coopname, ...organization });
    logger.info(`Данные организации ${existingMono ? 'обновлены' : 'созданы'}`);

    logger.info(`Система инициализирована (${isServerInit ? 'сервер' : 'пользователь'})`);
  }
}
