import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EdubridgeContract } from 'cooptypes';
import type { InnerChainDelta } from '@coopenomics/innercoop';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';

const CONTRACT = EdubridgeContract.contractName.production;

/**
 * Договор преподавателя в базе следует за таблицей `educontracts` цепи:
 * дельта приходит в том же блоке, что и подпись председателя, и сразу
 * (события действий идут с задержкой). Ответ на подпись ждёт именно её.
 */
@Injectable()
export class EdubridgeContractDeltaListener {
  constructor(private readonly teachers: EdubridgeTeacherService) {}

  @OnEvent(`delta::${CONTRACT}::educontracts`)
  async onContractDelta(delta: InnerChainDelta): Promise<void> {
    const v = delta.value ?? {};
    const username = v.username ? String(v.username) : '';
    const hash = v.contract_hash ? String(v.contract_hash) : '';
    if (!username || !hash) return;
    const approvedAt = v.approved_at ? String(v.approved_at) : null;
    await this.teachers.applyContractFromChain(delta.scope, username, hash, delta.present === false ? null : String(v.status ?? ''), approvedAt);
  }
}
