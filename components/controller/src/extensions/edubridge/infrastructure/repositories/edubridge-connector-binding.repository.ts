import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ConnectorResult } from '../../domain/connectors/access-carrier.connector';
import { EduAccessCarrier, EduConnectorHealth } from '../../domain/enums';
import { EdubridgeConnectorBindingEntity } from '../entities';

@Injectable()
export class EdubridgeConnectorBindingRepository {
  constructor(@InjectRepository(EdubridgeConnectorBindingEntity) private readonly repo: Repository<EdubridgeConnectorBindingEntity>) {}

  list(coopname: string): Promise<EdubridgeConnectorBindingEntity[]> {
    return this.repo.find({ where: { coopname }, order: { carrier: 'ASC' } });
  }

  async ensure(coopname: string, carrier: EduAccessCarrier): Promise<EdubridgeConnectorBindingEntity> {
    const existing = await this.repo.findOne({ where: { coopname, carrier } });
    if (existing) return existing;
    return this.repo.save(this.repo.create({ coopname, carrier, enabled: true, health: EduConnectorHealth.UNKNOWN }));
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
