import { Inject, Injectable } from '@nestjs/common';
import type { EduAccessCarrier } from '../../domain/enums';
import { ACCESS_CARRIER_CONNECTORS, type AccessCarrierConnector } from '../../domain/connectors/access-carrier.connector';

/** Фабрика коннекторов по носителю. Неизвестный носитель — `null`: задача уйдёт в needs_attention, а не упадёт. */
@Injectable()
export class AccessCarrierRegistry {
  private readonly byCarrier = new Map<EduAccessCarrier, AccessCarrierConnector>();

  constructor(@Inject(ACCESS_CARRIER_CONNECTORS) connectors: AccessCarrierConnector[]) {
    for (const c of connectors) this.byCarrier.set(c.carrier, c);
  }

  get(carrier: EduAccessCarrier): AccessCarrierConnector | null {
    return this.byCarrier.get(carrier) ?? null;
  }

  list(): AccessCarrierConnector[] {
    return [...this.byCarrier.values()];
  }
}
