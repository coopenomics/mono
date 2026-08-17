import { Inject, Injectable } from '@nestjs/common';
import { MeetBlockchainPort, MEET_BLOCKCHAIN_PORT } from '~/domain/meet/ports/meet-blockchain.port';
import { MeetPreProcessingRepository, MEET_REPOSITORY } from '~/domain/meet/repositories/meet-pre.repository';
import { MeetProcessedRepository, MEET_PROCESSED_REPOSITORY } from '~/domain/meet/repositories/meet-processed.repository';
import { MeetAggregate } from '~/domain/meet/aggregates/meet-domain.aggregate';
import { GetMeetInputDomainInterface } from '~/domain/meet/interfaces/get-meet-input-domain.interface';
import { GetMeetsInputDomainInterface } from '~/domain/meet/interfaces/get-meets-input-domain.interface';
import type { IMeetPort } from '@coopenomics/innercoop';

@Injectable()
export class MeetDataAdapter implements IMeetPort {
  constructor(
    @Inject(MEET_REPOSITORY) private readonly meetPreRepository: MeetPreProcessingRepository,
    @Inject(MEET_PROCESSED_REPOSITORY) private readonly meetProcessedRepository: MeetProcessedRepository,
    @Inject(MEET_BLOCKCHAIN_PORT) private readonly meetBlockchainPort: MeetBlockchainPort
  ) {}

  async getMeets(data: GetMeetsInputDomainInterface, username?: string): Promise<MeetAggregate[]> {
    // Получаем данные из блокчейна через порт
    const processingDataList = await this.meetBlockchainPort.getMeets({
      coopname: data.coopname,
      username,
    });

    // Если данных нет, возвращаем пустой массив
    if (!processingDataList || processingDataList.length === 0) {
      return [];
    }

    // Преобразуем данные в агрегаты, получая для каждого элемента данные из репозитория
    const meetsAggregates = await Promise.all(
      processingDataList.map(async (processingData) => {
        // Получаем данные pre из репозитория для каждого элемента по его хешу
        const preMeet = await this.meetPreRepository.findByHash(processingData.hash);

        // Получаем данные processed из репозитория
        const processedMeetEntity = await this.meetProcessedRepository.findByHash(processingData.hash);
        // Создаем агрегат с данными из репозитория и блокчейна
        return new MeetAggregate(preMeet, processingData, processedMeetEntity);
      })
    );

    return meetsAggregates;
  }

  async getMeet(data: GetMeetInputDomainInterface, username?: string): Promise<MeetAggregate> {
    // Получаем данные из блокчейна через порт
    const processingMeet = await this.meetBlockchainPort.getMeet({
      coopname: data.coopname,
      hash: data.hash,
      username,
    });

    // Получаем данные из репозитория
    const preMeet = await this.meetPreRepository.findByHash(data.hash);

    // Получаем данные из репозитория обработанных собраний
    const processedMeetEntity = await this.meetProcessedRepository.findByHash(data.hash);

    // Создаем агрегат из обоих источников данных (репозиторий и блокчейн)
    const meetAggregate = new MeetAggregate(preMeet, processingMeet, processedMeetEntity);

    // Вернем готовый агрегат
    return meetAggregate;
  }

  /** Черновик собрания по хэшу — реализация `IMeetPort.getMeetDraft`. */
  async getMeetDraft(hash: string) {
    return this.meetPreRepository.findByHash(hash);
  }
}
