import { Inject, Injectable } from '@nestjs/common';
import { EdubridgeContract } from 'cooptypes';
import httpStatus from 'http-status';
import { DomainError } from '@coopenomics/extension-kit';
import {
  CHAIN_PORT,
  VAULT_PORT,
  type IChainPort,
  type InnerChainAction,
  type InnerTransactResult,
  type IVaultPort,
} from '@coopenomics/innercoop';
import type { EdubridgeChainPort, EduSubscribeExtras } from '../../domain/ports/edubridge-chain.port';

/**
 * Все действия `edubridge` требуют `require_auth(coopname)`: пайщик подписывает
 * документ, транзакцию отправляет кооператив своим ключом из хранилища.
 */
@Injectable()
export class EdubridgeChainAdapter implements EdubridgeChainPort {
  constructor(
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(VAULT_PORT) private readonly vault: IVaultPort
  ) {}

  private async prepare(coopname: string): Promise<void> {
    const wif = await this.vault.getWif(coopname);
    if (!wif) throw new DomainError('EDUBRIDGE_COOP_PRIVATE_KEY_NOT_FOUND', {}, httpStatus.BAD_GATEWAY);
    this.chain.initialize(coopname, wif);
  }

  /**
   * Документ в цепи хранит `meta` строкой JSON. Без этой сериализации в таблицу
   * уходит «[object Object]», и синхронизатор одобрений совета не может
   * разобрать документ — запрос до стола председателя не доходит.
   */
  private chainDoc(document: unknown): Record<string, unknown> {
    const doc = document as Record<string, unknown>;
    return { ...doc, meta: typeof doc.meta === 'string' ? doc.meta : JSON.stringify(doc.meta ?? {}) };
  }

  private action(name: string, data: Record<string, unknown>, coopname: string): InnerChainAction {
    return {
      account: EdubridgeContract.contractName.production,
      name,
      authorization: [{ actor: coopname, permission: 'active' }],
      data,
    };
  }

  private one(name: string, data: object, coopname: string): Promise<InnerTransactResult> {
    return this.chain.transact(this.action(name, data as Record<string, unknown>, coopname));
  }

  async setCourse(data: EdubridgeContract.Actions.Setcourse.ISetcourse): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.one(EdubridgeContract.Actions.Setcourse.actionName, data, data.coopname);
  }

  async setAssignment(data: EdubridgeContract.Actions.Setassign.ISetassign): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.one(EdubridgeContract.Actions.Setassign.actionName, data, data.coopname);
  }

  async removeAssignment(data: EdubridgeContract.Actions.Delassign.IDelassign): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.one(EdubridgeContract.Actions.Delassign.actionName, data, data.coopname);
  }

  async convertAndSubscribe(
    convert: EdubridgeContract.Actions.Convert.IConvert | null,
    open: EdubridgeContract.Actions.Opensub.IOpensub | null,
    charge: EdubridgeContract.Actions.Chargefee.IChargefee,
    extras: EduSubscribeExtras = {}
  ): Promise<InnerTransactResult> {
    const coopname = charge.coopname;
    await this.prepare(coopname);
    // Конвертации нет, когда взнос покрыт остатком кошелька программы целиком:
    // заявление тогда публикуется отдельным действием — в реестр документов
    // оно обязано попасть в любом случае.
    const first = convert
      ? [this.action(EdubridgeContract.Actions.Convert.actionName, { ...convert, statement: this.chainDoc(convert.statement) }, coopname)]
      : extras.statement
        ? [this.action(EdubridgeContract.Actions.Regstatement.actionName, { ...extras.statement, statement: this.chainDoc(extras.statement.statement) }, coopname)]
        : [];
    return this.chain.transact([
      ...first,
      ...(open ? [this.action(EdubridgeContract.Actions.Opensub.actionName, open as unknown as Record<string, unknown>, coopname)] : []),
      // Взнос идёт последним: подписка к этому моменту существует, и контракт
      // считает по ней сумму, срок и удержание по гарантии.
      this.action(EdubridgeContract.Actions.Chargefee.actionName, charge as unknown as Record<string, unknown>, coopname),
    ]);
  }

  async createExpense(data: EdubridgeContract.Actions.CreateExp.ICreateexp): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.CreateExp.actionName, { ...data, statement: this.chainDoc(data.statement) }, data.coopname)
    );
  }

  async expireSubscription(data: EdubridgeContract.Actions.Expiresub.IExpiresub): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Expiresub.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async unlockFee(data: EdubridgeContract.Actions.Unlockfee.IUnlockfee): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.one(EdubridgeContract.Actions.Unlockfee.actionName, data, data.coopname);
  }

  async cancelSubscription(data: EdubridgeContract.Actions.Cancelsub.ICancelsub): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.one(EdubridgeContract.Actions.Cancelsub.actionName, data, data.coopname);
  }

  async claimGuarantee(data: EdubridgeContract.Actions.Warrclaim.IWarrclaim): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Warrclaim.actionName, { ...data, statement: this.chainDoc(data.statement) }, data.coopname)
    );
  }

  async grantGuarantee(data: EdubridgeContract.Actions.Warrgrant.IWarrgrant): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Warrgrant.actionName, { ...data, decision: this.chainDoc(data.decision) }, data.coopname)
    );
  }

  async openLesson(data: EdubridgeContract.Actions.Openlesson.IOpenlesson): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.one(EdubridgeContract.Actions.Openlesson.actionName, data, data.coopname);
  }

  async dropLesson(data: EdubridgeContract.Actions.Droplesson.IDroplesson): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.one(EdubridgeContract.Actions.Droplesson.actionName, data, data.coopname);
  }

  async chargeLesson(data: EdubridgeContract.Actions.Chargelesson.IChargelesson): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.one(EdubridgeContract.Actions.Chargelesson.actionName, data, data.coopname);
  }

  // ── Чтение расчётов контракта ──────────────────────────────────────────

  private get code(): string {
    return EdubridgeContract.contractName.production;
  }

  readSubscription(coopname: string, subHash: string): Promise<EdubridgeContract.Tables.EduSubs.IEduSubscription | null> {
    return this.chain.getSingleRow(this.code, coopname, EdubridgeContract.Tables.EduSubs.tableName, subHash, 'secondary', 'sha256');
  }

  readTerms(coopname: string, courseRef: string | number): Promise<EdubridgeContract.Tables.EduTerms.IEduTerms | null> {
    return this.chain.getSingleRow(this.code, coopname, EdubridgeContract.Tables.EduTerms.tableName, String(courseRef));
  }

async declineGuarantee(data: EdubridgeContract.Actions.Warrdecline.IWarrdecline): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Warrdecline.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  readAssignment(coopname: string, assignmentRef: string | number): Promise<EdubridgeContract.Tables.EduAssigns.IEduAssignment | null> {
    return this.chain.getSingleRow(this.code, coopname, EdubridgeContract.Tables.EduAssigns.tableName, String(assignmentRef));
  }

    readLesson(coopname: string, ridHash: string): Promise<EdubridgeContract.Tables.EduLessons.IEduLesson | null> {
    return this.chain.getSingleRow(this.code, coopname, EdubridgeContract.Tables.EduLessons.tableName, ridHash, 'secondary', 'sha256');
  }

  readCourseFunds(coopname: string, courseRef: string | number): Promise<EdubridgeContract.Tables.EduCourses.IEduCourse | null> {
    return this.chain.getSingleRow(this.code, coopname, EdubridgeContract.Tables.EduCourses.tableName, String(courseRef));
  }

  async holdRid(data: EdubridgeContract.Actions.Holdrid.IHoldrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Holdrid.actionName, { ...data, act: this.chainDoc(data.act) }, data.coopname)
    );
  }

  async withdrawShare(data: EdubridgeContract.Actions.Wthshare.IWthshare): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Wthshare.actionName, { ...data, statement: this.chainDoc(data.statement) }, data.coopname)
    );
  }

  async submitRid(data: EdubridgeContract.Actions.Submitrid.ISubmitrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Submitrid.actionName, { ...data, statement: this.chainDoc(data.statement) }, data.coopname)
    );
  }

  async acceptRid(data: EdubridgeContract.Actions.Acceptrid.IAcceptrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Acceptrid.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async signRidAct(data: EdubridgeContract.Actions.SignRidAct.ISignRidAct): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(
        EdubridgeContract.Actions.SignRidAct.actionName,
        { ...data, decision: this.chainDoc(data.decision), act: this.chainDoc(data.act) },
        data.coopname
      )
    );
  }

  async signContract(data: EdubridgeContract.Actions.Signcontract.ISigncontract): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Signcontract.actionName, { ...data, contract: this.chainDoc(data.contract) }, data.coopname)
    );
  }

  async declineRid(data: EdubridgeContract.Actions.Declinerid.IDeclinerid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Declinerid.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async terminateContract(data: EdubridgeContract.Actions.Termcontract.ITermcontract): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Termcontract.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async recallRid(data: EdubridgeContract.Actions.Recallrid.IRecallrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Recallrid.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }
}
