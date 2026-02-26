import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as cron from 'node-cron';
import { ContributorRepository, CONTRIBUTOR_REPOSITORY } from '../../domain/repositories/contributor.repository';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import { ContributorStatus } from '../../domain/enums/contributor-status.enum';
import { config } from '~/config';
import { Inject } from '@nestjs/common';

/**
 * Сервис планировщика для автоматического обновления энергии участников (геймификация)
 * Управляет cron задачами для периодического применения decay к энергии участников
 */
@Injectable()
export class GamificationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GamificationSchedulerService.name);
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    @Inject(CONTRIBUTOR_REPOSITORY) private readonly contributorRepository: ContributorRepository,
    @Inject(CAPITAL_BLOCKCHAIN_PORT) private readonly blockchainPort: CapitalBlockchainPort
  ) {}

  /**
   * Инициализация сервиса при старте модуля
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Инициализация планировщика геймификации...');

    // Запускаем обновление энергии каждый день в полночь (или каждую минуту в dev режиме)
    const cronExpression = config.env === 'development' ? '* * * * *' : '0 0 * * *';
    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        await this.refreshAllContributorsEnergy();
      } catch (error) {
        this.logger.error('Ошибка в задаче обновления энергии участников по расписанию', error);
      }
    });

    // Также выполняем первичное обновление энергии при запуске
    try {
      await this.refreshAllContributorsEnergy();
    } catch (error) {
      this.logger.warn(
        'Первичное обновление энергии участников не удалось, будет повторена попытка при следующем запуске по расписанию',
        error
      );
    }

    this.logger.log('Планировщик геймификации успешно инициализирован');
  }

  /**
   * Остановка сервиса
   */
  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger.log('Планировщик геймификации остановлен');
    }
  }

  onModuleDestroy() {
    return this.stop();
  }

  /**
   * Обновление энергии всех активных участников
   */
  private async refreshAllContributorsEnergy(): Promise<void> {
    this.logger.debug('Начинаем ежедневное обновление энергии участников...');

    try {
      const coopname = config.coopname;

      // Получаем всех участников текущего кооператива
      const allContributors = await this.contributorRepository.findAll();
      const coopContributors = allContributors.filter((c) => c.coopname === coopname);

      // Фильтруем участников, исключая тех, кто имеет статус INACTIVE или UNDEFINED
      const contributorsToUpdate = coopContributors.filter(
        (contributor) =>
          contributor.status !== ContributorStatus.INACTIVE && contributor.status !== ContributorStatus.UNDEFINED && contributor.status !== ContributorStatus.PENDING
      );

      if (contributorsToUpdate.length === 0) {
        this.logger.debug(`Нет участников кооператива ${coopname} для обновления энергии (все неактивны или неопределены)`);
        return;
      }

      this.logger.log(`Найдено ${contributorsToUpdate.length} участников кооператива ${coopname} для обновления энергии`);

      // Обновляем каждого участника
      for (const contributor of contributorsToUpdate) {
        try {
          // Проверяем, подписал ли участник договор УХД
          if (!contributor.contract || !contributor.blockchain_status) {
            this.logger.debug(`Пропускаем обновление энергии для участника ${contributor.username} - договор УХД не подписан`);
            continue;
          }

          await this.blockchainPort.refreshContributor({
            coopname,
            username: contributor.username,
          });

          this.logger.debug(`Обновлена энергия участника ${contributor.username} в кооперативе ${coopname}`);
        } catch (error) {
          this.logger.error(
            `Не удалось обновить энергию участника ${contributor.username} в кооперативе ${coopname}`,
            error
          );
          // Продолжаем обработку остальных участников даже при ошибке одного
        }
      }

      this.logger.debug('Ежедневное обновление энергии участников завершено успешно');
    } catch (error) {
      this.logger.error('Критическая ошибка при обновлении энергии участников', error);
      throw error;
    }
  }
}
