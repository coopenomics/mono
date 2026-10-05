import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EdubridgeContract, SovietContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';
import { EduCouncilOutcome } from '../../domain/enums';
import { EdubridgeGuaranteeService } from '../services/edubridge-guarantee.service';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';

const CONTRACT = EdubridgeContract.contractName.production;
const SOVIET = SovietContract.contractName.production;

/**
 * Вторая подпись председателя приходит не мутацией, а действием цепи:
 * `soviet::confirmapprv` / `declineapprv` вызывают коллбэк в `edubridge`, и
 * только по нему договор УХД становится действующим.
 * Так же слушает свои коллбэки «Благорост» (`capital::apprvappndx`).
 */
@Injectable()
export class EdubridgeApprovalListener {
  constructor(
    private readonly teachers: EdubridgeTeacherService,
    private readonly guarantee: EdubridgeGuaranteeService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeApprovalListener.name);
  }

  @OnEvent(`action::${CONTRACT}::${EdubridgeContract.Actions.Apprvcontr.actionName}`)
  async onContractApproved(action: InnerChainActionRecord): Promise<void> {
    const d = action.data as EdubridgeContract.Actions.Apprvcontr.IApprvcontr;
    if (!d?.coopname || !d?.contract_hash) return;
    await this.teachers.onContractApproved(String(d.coopname), String(d.contract_hash));
    // Документ из цепи приходит в её формате (метаданные строкой) — в запись кладётся подписанный документ узла.
    const approved = d.approved_document ? DomainToBlockchainUtils.convertChainDocumentToDomainFormat(d.approved_document as never) : undefined;
    await this.teachers.saveApprovedContractDocument(String(d.coopname), String(d.contract_hash), approved as never);
  }

  @OnEvent(`action::${CONTRACT}::${EdubridgeContract.Actions.Dclinecontr.actionName}`)
  async onContractDeclined(action: InnerChainActionRecord): Promise<void> {
    const d = action.data as EdubridgeContract.Actions.Dclinecontr.IDclinecontr;
    if (!d?.coopname || !d?.contract_hash) return;
    await this.teachers.onContractDeclined(String(d.coopname), String(d.contract_hash), String(d.reason ?? ''));
  }

  /** Совет отклонил вопрос о приёме результата — заявление помечается, материалы снимает председатель. */
  @OnEvent(`action::${SOVIET}::${SovietContract.Actions.Decisions.Declinedec.actionName}`)
  async onCouncilDeclined(action: InnerChainActionRecord): Promise<void> {
    await this.councilGaveUp(action, EduCouncilOutcome.DECLINED);
  }

  /** Вопрос не набрал голосов в срок и снят с повестки. */
  @OnEvent(`action::${SOVIET}::${SovietContract.Actions.Decisions.Cancelexprd.actionName}`)
  async onCouncilExpired(action: InnerChainActionRecord): Promise<void> {
    await this.councilGaveUp(action, EduCouncilOutcome.EXPIRED);
  }

  private async councilGaveUp(action: InnerChainActionRecord, outcome: EduCouncilOutcome): Promise<void> {
    const d = action.data as { coopname?: string; decision_id?: string | number } | undefined;
    if (!d?.coopname || d.decision_id === undefined || d.decision_id === null) return;
    await this.teachers.onCouncilGaveUp(String(d.coopname), String(d.decision_id), outcome);
    // Тот же исход совета закрывает и заявление по гарантийным условиям, если вопрос был о нём.
    await this.guarantee.onCouncilGaveUp(String(d.coopname), String(d.decision_id), outcome);
  }
}
