import type { EdubridgeContract } from 'cooptypes';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Действия контракта `edubridge` от имени кооператива. Пакет из нескольких
 * действий проходит одной транзакцией — либо целиком, либо никак.
 *
 * Денежные суммы считает контракт по условиям курса. Приложение сумм не
 * передаёт: оно задаёт условия (`setCourse`, `setAssignment`), вызывает
 * действие и читает результат из таблиц цепи.
 */
/** Что ещё едет в транзакции оплаты подписки. */
export interface EduSubscribeExtras {
  /** Заявление публикуется отдельно, когда конвертации нет и `convert` его не несёт. */
  statement?: EdubridgeContract.Actions.Regstatement.IRegstatement;
}

export interface EdubridgeChainPort {
  /** Условия курса в цепи: по ним контракт считает взнос, резерв, расчёт с преподавателем и возврат. */
  setCourse(data: EdubridgeContract.Actions.Setcourse.ISetcourse): Promise<InnerTransactResult>;
  /** Допуск преподавателя к курсу и его ставка за час на одного участника. */
  setAssignment(data: EdubridgeContract.Actions.Setassign.ISetassign): Promise<InnerTransactResult>;
  removeAssignment(data: EdubridgeContract.Actions.Delassign.IDelassign): Promise<InnerTransactResult>;
  /**
   * Оплата подписки одной транзакцией: конвертация (когда есть недостача),
   * открытие подписки (у новой) и взнос. `convert` пуст, если взнос покрыт
   * остатком кошелька программы целиком. Сумму, срок и удержание по гарантии
   * считает контракт; `charge.expected` — сумма из подписанного заявления.
   */
  convertAndSubscribe(
    convert: EdubridgeContract.Actions.Convert.IConvert | null,
    open: EdubridgeContract.Actions.Opensub.IOpensub | null,
    charge: EdubridgeContract.Actions.Chargefee.IChargefee,
    extras?: EduSubscribeExtras
  ): Promise<InnerTransactResult>;
  expireSubscription(data: EdubridgeContract.Actions.Expiresub.IExpiresub): Promise<InnerTransactResult>;
  /** Отмена подписки с возвратом взноса; основание и сумму определяет контракт. */
  cancelSubscription(data: EdubridgeContract.Actions.Cancelsub.ICancelsub): Promise<InnerTransactResult>;
  /** Заявление об аннулировании подписки по гарантийным условиям публикуется в реестре документов. */
  claimGuarantee(data: EdubridgeContract.Actions.Warrclaim.IWarrclaim): Promise<InnerTransactResult>;
  /** Совет удовлетворил заявление: контракт закрывает подписку с возвратом всего взноса и публикует протокол. */
  grantGuarantee(data: EdubridgeContract.Actions.Warrgrant.IWarrgrant): Promise<InnerTransactResult>;
  /** Гарантийный срок участника истёк: контракт освобождает удержанное и выделяет резерв преподавателям. */
  unlockFee(data: EdubridgeContract.Actions.Unlockfee.IUnlockfee): Promise<InnerTransactResult>;
  /** Отчёт преподавателя о занятии: открывает расчёт с участниками. */
  openLesson(data: EdubridgeContract.Actions.Openlesson.IOpenlesson): Promise<InnerTransactResult>;
  /** Отзыв отчёта о занятии до расчёта с участниками. */
  dropLesson(data: EdubridgeContract.Actions.Droplesson.IDroplesson): Promise<InnerTransactResult>;
  /** Расчёт за занятие по одной подписке. */
  chargeLesson(data: EdubridgeContract.Actions.Chargelesson.IChargelesson): Promise<InnerTransactResult>;
  /** Приём материалов занятия на ответственное хранение; сумму и срок берёт контракт из записи занятия. */
  holdRid(data: EdubridgeContract.Actions.Holdrid.IHoldrid): Promise<InnerTransactResult>;
  submitRid(data: EdubridgeContract.Actions.Submitrid.ISubmitrid): Promise<InnerTransactResult>;
  acceptRid(data: EdubridgeContract.Actions.Acceptrid.IAcceptrid): Promise<InnerTransactResult>;
  /** Акт приёма-передачи РИД с подписью преподавателя — уходит председателю на одобрение вместе с протоколом совета. */
  signRidAct(data: EdubridgeContract.Actions.SignRidAct.ISignRidAct): Promise<InnerTransactResult>;
  declineRid(data: EdubridgeContract.Actions.Declinerid.IDeclinerid): Promise<InnerTransactResult>;
  /** Снятие материалов с ответственного хранения по рекламации внутри срока. */
  recallRid(data: EdubridgeContract.Actions.Recallrid.IRecallrid): Promise<InnerTransactResult>;
  /** Трансляция паевого взноса преподавателя с кошелька программы в «Цифровой Кошелёк» по его заявлению. */
  withdrawShare(data: EdubridgeContract.Actions.Wthshare.IWthshare): Promise<InnerTransactResult>;
  /** Договор УХД преподавателя (первая подпись) — уходит председателю на одобрение. */
  signContract(data: EdubridgeContract.Actions.Signcontract.ISigncontract): Promise<InnerTransactResult>;
  /** Прекращение договора УХД — выход преподавателя из кооператива либо соглашение сторон. */
  terminateContract(data: EdubridgeContract.Actions.Termcontract.ITermcontract): Promise<InnerTransactResult>;
  /** Расход программы: средства фонда уходят в пул расходов, записка — в шасси. */
  createExpense(data: EdubridgeContract.Actions.CreateExp.ICreateexp): Promise<InnerTransactResult>;

  // ── Чтение расчётов контракта ──────────────────────────────────────────
  /** Подписка в цепи: суммы, оплаченный срок и учёт занятий. `null` — подписка закрыта. */
  readSubscription(coopname: string, subHash: string): Promise<EdubridgeContract.Tables.EduSubs.IEduSubscription | null>;
  /** Условия курса в цепи. `null` — ещё не заданы. */
  readTerms(coopname: string, courseRef: string | number): Promise<EdubridgeContract.Tables.EduTerms.IEduTerms | null>;
  /** Занятие, по которому идёт расчёт: число участников и сумма. `null` — расчёт завершён. */
  readLesson(coopname: string, ridHash: string): Promise<EdubridgeContract.Tables.EduLessons.IEduLesson | null>;
  /** Учёт средств курса: собрано, резерв преподавателям, выплачено. */
  readCourseFunds(coopname: string, courseRef: string | number): Promise<EdubridgeContract.Tables.EduCourses.IEduCourse | null>;
}

export const EDUBRIDGE_CHAIN_PORT = Symbol('EDUBRIDGE_CHAIN_PORT');
