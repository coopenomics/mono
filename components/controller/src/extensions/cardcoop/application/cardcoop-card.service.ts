/**
 * Состояние карты кооператора для стола кооператива (story 7.4).
 *
 * Данные берутся из собственного журнала расширения, а не из сети: стол обязан работать,
 * когда card.coop недоступен (NFR-3). Кооператив и так знает всё, что нужно показать, —
 * он сам выдавал свидетельство о членстве и сам получал уведомление о связке.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CardcoopAttestationState,
  CardcoopAttestationTypeormEntity,
} from '../infrastructure/entities/cardcoop-attestation.typeorm-entity';
import { CardcoopPendingLinkTypeormEntity } from '../infrastructure/entities/cardcoop-pending-link.typeorm-entity';
import type { CardcoopMyCardDTO } from './dto/cardcoop-my-card.dto';

/** Состояния, в которых членство уже не действует: карта есть, а свидетельства нет. */
const CLOSED_STATES: readonly CardcoopAttestationState[] = [CardcoopAttestationState.Revoked];

@Injectable()
export class CardcoopCardService {
  constructor(
    @InjectRepository(CardcoopAttestationTypeormEntity)
    private readonly attestations: Repository<CardcoopAttestationTypeormEntity>,
    @InjectRepository(CardcoopPendingLinkTypeormEntity)
    private readonly pendingLinks: Repository<CardcoopPendingLinkTypeormEntity>
  ) {}

  /**
   * Карта кооператора глазами кооператива.
   *
   * Берётся самая свежая запись журнала: пайщик мог выйти и вступить заново, и показывать
   * ему прекращённое членство при действующем — значит показывать прошлое вместо настоящего.
   *
   * @param username — пайщик из токена.
   * @param apiUrl — адрес сети из настроек расширения.
   * @param coopname — имя кооператива: из него собирается адрес выпуска карты.
   * @returns Состояние карты для показа в столе.
   */
  async forMember(username: string, apiUrl: string, coopname: string): Promise<CardcoopMyCardDTO> {
    const enterUrl = `${apiUrl.replace(/\/+$/, '')}/enter/${coopname}`;

    const records = await this.attestations.find({
      where: { username },
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    const record = records[0];
    if (!record) {
      // Карта, связанная при вступлении: свидетельства ещё нет и быть не может — совет не
      // решил, — но карта у человека уже есть, и говорить ему «не выпущена» неправда.
      const pending = await this.pendingLinks.findOne({ where: { username } });
      if (pending) {
        return {
          issued: true,
          cardNumber: pending.cardNumber,
          state: CardcoopAttestationState.Pending,
          memberSince: null,
          enterUrl,
        };
      }

      return { issued: false, cardNumber: null, state: null, memberSince: null, enterUrl };
    }

    return {
      // Запись журнала появляется по уведомлению о связке — значит карта у человека уже есть,
      // даже если свидетельство ещё не доехало до сети или было отозвано.
      issued: true,
      cardNumber: record.cardNumber,
      state: record.state,
      memberSince: CLOSED_STATES.includes(record.state) ? null : record.memberSince,
      enterUrl,
    };
  }
}
