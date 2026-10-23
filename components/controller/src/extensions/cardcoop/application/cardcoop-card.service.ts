/**
 * Состояние карты кооператора для стола кооператива (story 7.4).
 *
 * Данные берутся из собственного журнала расширения, а не из сети: стол обязан работать,
 * когда card.coop недоступен (NFR-3). Кооператив и так знает всё, что нужно показать, —
 * он сам выдавал свидетельство о членстве и сам получал уведомление о связи.
 */
import { TableStore } from '@coopenomics/extension-kit';
import { CARDCOOP_ATTESTATION_STORE, CARDCOOP_PENDING_LINK_STORE } from '../infrastructure/database/cardcoop-stores';
import { Inject, Injectable } from '@nestjs/common';
import {
  CardcoopAttestationState,
  CardcoopAttestationRecord,
} from '../infrastructure/records/cardcoop-attestation.record';
import { CardcoopPendingLinkRecord } from '../infrastructure/records/cardcoop-pending-link.record';
import type { CardcoopMyCardDTO } from './dto/cardcoop-my-card.dto';

/** Состояния, в которых членство уже не действует: карта есть, а свидетельства нет. */
const CLOSED_STATES: readonly CardcoopAttestationState[] = [CardcoopAttestationState.Revoked];

@Injectable()
export class CardcoopCardService {
  constructor(
    @Inject(CARDCOOP_ATTESTATION_STORE)
    private readonly attestations: TableStore<CardcoopAttestationRecord>,
    @Inject(CARDCOOP_PENDING_LINK_STORE)
    private readonly pendingLinks: TableStore<CardcoopPendingLinkRecord>
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

    const records = await this.attestations.find({ username }, { order: { updatedAt: 'DESC' }, limit: 1 });

    const record = records[0];
    if (!record) {
      // Карта, связанная при вступлении: свидетельства ещё нет и быть не может — совет не
      // решил, — но карта у человека уже есть, и говорить ему «не выпущена» неправда.
      const pending = await this.pendingLinks.findOne({ username });
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
      // Запись журнала появляется по уведомлению о связи — значит карта у человека уже есть,
      // даже если свидетельство ещё не доехало до сети или было отозвано.
      issued: true,
      cardNumber: record.cardNumber,
      state: record.state,
      memberSince: CLOSED_STATES.includes(record.state) ? null : record.memberSince,
      enterUrl,
    };
  }
}
