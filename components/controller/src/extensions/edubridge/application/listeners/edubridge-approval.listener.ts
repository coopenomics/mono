import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EdubridgeContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';

const CONTRACT = EdubridgeContract.contractName.production;

/**
 * Вторая подпись председателя приходит не мутацией, а действием цепи:
 * `soviet::confirmapprv` / `declineapprv` вызывают коллбэк в `edubridge`, и
 * только по нему договор УХД становится действующим, а назначение — активным.
 * Так же слушает свои коллбэки «Благорост» (`capital::apprvappndx`).
 */
@Injectable()
export class EdubridgeApprovalListener {
  constructor(
    private readonly teachers: EdubridgeTeacherService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeApprovalListener.name);
  }

  @OnEvent(`action::${CONTRACT}::${EdubridgeContract.Actions.Apprvcontr.actionName}`)
  async onContractApproved(action: InnerChainActionRecord): Promise<void> {
    const d = action.data as EdubridgeContract.Actions.Apprvcontr.IApprvcontr;
    if (!d?.coopname || !d?.username || !d?.contract_hash) return;
    await this.teachers.onContractApproved(String(d.coopname), String(d.username), String(d.contract_hash));
  }

  @OnEvent(`action::${CONTRACT}::${EdubridgeContract.Actions.Dclinecontr.actionName}`)
  async onContractDeclined(action: InnerChainActionRecord): Promise<void> {
    const d = action.data as EdubridgeContract.Actions.Dclinecontr.IDclinecontr;
    if (!d?.coopname || !d?.username || !d?.contract_hash) return;
    await this.teachers.onContractDeclined(String(d.coopname), String(d.username), String(d.contract_hash), String(d.reason ?? ''));
  }

  @OnEvent(`action::${CONTRACT}::${EdubridgeContract.Actions.Apprvannex.actionName}`)
  async onAnnexApproved(action: InnerChainActionRecord): Promise<void> {
    const d = action.data as EdubridgeContract.Actions.Apprvannex.IApprvannex;
    if (!d?.coopname || !d?.username || !d?.annex_hash) return;
    await this.teachers.onAnnexApproved(String(d.coopname), String(d.username), String(d.annex_hash));
  }

  @OnEvent(`action::${CONTRACT}::${EdubridgeContract.Actions.Dclineannex.actionName}`)
  async onAnnexDeclined(action: InnerChainActionRecord): Promise<void> {
    const d = action.data as EdubridgeContract.Actions.Dclineannex.IDclineannex;
    if (!d?.coopname || !d?.username || !d?.annex_hash) return;
    await this.teachers.onAnnexDeclined(String(d.coopname), String(d.username), String(d.annex_hash), String(d.reason ?? ''));
  }
}
