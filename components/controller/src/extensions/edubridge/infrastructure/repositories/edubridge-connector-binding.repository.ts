import { Inject, Injectable } from '@nestjs/common';
import { TableStore } from '@coopenomics/extension-kit';
import { EDUBRIDGE_CONNECTOR_BINDING_STORE } from '../database/edubridge-stores';
import type { ConnectorResult } from '../../domain/connectors/access-carrier.connector';
import { EduAccessCarrier, EduConnectorHealth } from '../../domain/enums';
import { EdubridgeConnectorBindingEntity } from '../entities';

@Injectable()
export class EdubridgeConnectorBindingRepository {
  constructor(@Inject(EDUBRIDGE_CONNECTOR_BINDING_STORE) private readonly repo: TableStore<EdubridgeConnectorBindingEntity>) {}

  list(coopname: string): Promise<EdubridgeConnectorBindingEntity[]> {
    return this.repo.find({ coopname }, { order: { carrier: 'ASC' } });
  }

  /**
   * Привязка площадки к кооперативу; при первом обращении заводится. Форма
   * курса обращается к привязке несколькими запросами сразу, поэтому «найти,
   * иначе вставить» гонялось: обе ветки не находили запись и вторая вставка
   * падала на уникальном индексе (кооператив, площадка). Вставка без конфликта
   * и чтение следом отдают всем одну и ту же запись.
   */
  async ensure(coopname: string, carrier: EduAccessCarrier): Promise<EdubridgeConnectorBindingEntity> {
    const existing = await this.repo.findOne({ coopname, carrier });
    if (existing) return existing;
    await this.repo.kysely
      .insertInto(this.repo.table)
      .values({ coopname, carrier, enabled: true, health: EduConnectorHealth.UNKNOWN })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
    return this.repo.findOneOrFail({ coopname, carrier });
  }

  /** Отметить результат обращения к площадке. */
  async touch(coopname: string, carrier: EduAccessCarrier, result: ConnectorResult): Promise<void> {
    const b = await this.ensure(coopname, carrier);
    b.last_check_at = new Date();
    b.last_check_message = result.message ?? null;
    if (result.error_code === 'LICENSE_LIMIT') b.health = EduConnectorHealth.LICENSE_LIMIT;
    else if (result.code === 'ok' || result.code === 'exists') b.health = EduConnectorHealth.OK;
    else if (result.code === 'retryable') b.health = EduConnectorHealth.FAILING;
    await this.repo.save(b);
  }

  async setHealth(coopname: string, carrier: EduAccessCarrier, health: EduConnectorHealth, message: string | null): Promise<void> {
    const b = await this.ensure(coopname, carrier);
    b.health = health;
    b.last_check_at = new Date();
    b.last_check_message = message;
    await this.repo.save(b);
  }

  save(b: EdubridgeConnectorBindingEntity): Promise<EdubridgeConnectorBindingEntity> {
    return this.repo.save(b);
  }
}
