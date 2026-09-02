import { Cooperative } from 'cooptypes';
import { Classes, Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { DigitalDocument } from 'src/shared/lib/document';
import { useGlobalStore } from 'src/shared/store';

export type IContract = NonNullable<Queries.Edubridge.MyContract.IOutput['edubridgeMyContract']>;
export type IAssignment = Queries.Edubridge.MyAssignments.IOutput['edubridgeMyAssignments'][number];
export type IContribution = Queries.Edubridge.MyContributions.IOutput['edubridgeMyContributions'][number];
export type ISettlement = Queries.Edubridge.MySettlement.IOutput['edubridgeMySettlement'];
export type IContributionDraftInput = Mutations.Edubridge.DraftContribution.IInput['data'];
export type IAssignmentInput = Mutations.Edubridge.CreateAssignment.IInput['data'];

// Ключи — имена enum'ов схемы (`Zeus.*`): именно их отдаёт и принимает GraphQL.
export const RID_TYPE_LABELS: Record<string, string> = {
  [Zeus.EduRidType.LESSON_RECORDING]: 'Запись занятия',
  [Zeus.EduRidType.METHODICAL_MATERIAL]: 'Методический материал',
  [Zeus.EduRidType.COURSE_PROGRAM]: 'Программа курса',
  [Zeus.EduRidType.ASSESSMENT_MATERIAL]: 'Контрольные материалы',
  [Zeus.EduRidType.OTHER]: 'Другое',
};

export const CONTRIBUTION_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduContributionStatus.DRAFT]: { label: 'Черновик', variant: 'neutral' },
  [Zeus.EduContributionStatus.SUBMITTED]: { label: 'На рассмотрении совета', variant: 'info' },
  [Zeus.EduContributionStatus.COUNCIL_APPROVED]: { label: 'Ждёт подписи акта', variant: 'warn' },
  [Zeus.EduContributionStatus.ACT_SIGNED]: { label: 'Ждёт подписи председателя', variant: 'info' },
  [Zeus.EduContributionStatus.ACCEPTED]: { label: 'Принят', variant: 'pos' },
  [Zeus.EduContributionStatus.DECLINED]: { label: 'Отклонён', variant: 'neg' },
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduAssignmentStatus.DRAFT]: { label: 'Ждёт подписи приложения', variant: 'warn' },
  [Zeus.EduAssignmentStatus.PENDING_APPROVAL]: { label: 'Ждёт подписи председателя', variant: 'info' },
  [Zeus.EduAssignmentStatus.ACTIVE]: { label: 'Действует', variant: 'pos' },
  [Zeus.EduAssignmentStatus.DECLINED]: { label: 'Отклонено председателем', variant: 'neg' },
  [Zeus.EduAssignmentStatus.CLOSED]: { label: 'Закрыто', variant: 'neutral' },
};

/** Договор УХД: первая подпись — преподаватель, вторая — председатель совета со стола «Запросы одобрений». */
export const CONTRACT_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'info' }> = {
  [Zeus.EduContractStatus.PENDING_APPROVAL]: { label: 'Ждёт подписи председателя', variant: 'info' },
  [Zeus.EduContractStatus.ACTIVE]: { label: 'Действует', variant: 'pos' },
  [Zeus.EduContractStatus.DECLINED]: { label: 'Отклонён председателем', variant: 'neg' },
};

async function q<T>(query: any, name: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await client.Query(query, variables ? { variables } : undefined);
  return (res as Record<string, T>)[name] as T;
}
async function m<T>(mutation: any, name: string, variables: Record<string, unknown>): Promise<T> {
  const res = await client.Mutation(mutation, { variables });
  return (res as Record<string, T>)[name] as T;
}

export const fetchMyContract = () => q<IContract | null>(Queries.Edubridge.MyContract.query, Queries.Edubridge.MyContract.name);
export const fetchMyAssignments = () => q<IAssignment[]>(Queries.Edubridge.MyAssignments.query, Queries.Edubridge.MyAssignments.name);
export const fetchMyContributions = () => q<IContribution[]>(Queries.Edubridge.MyContributions.query, Queries.Edubridge.MyContributions.name);
export const fetchMySettlement = () => q<ISettlement>(Queries.Edubridge.MySettlement.query, Queries.Edubridge.MySettlement.name);
export const fetchAssignments = () => q<IAssignment[]>(Queries.Edubridge.Assignments.query, Queries.Edubridge.Assignments.name);
export const fetchContributions = () => q<IContribution[]>(Queries.Edubridge.Contributions.query, Queries.Edubridge.Contributions.name);
export const draftContribution = (data: IContributionDraftInput) => m<IContribution>(Mutations.Edubridge.DraftContribution.mutation, Mutations.Edubridge.DraftContribution.name, { data });
export const createAssignment = (data: IAssignmentInput) => m<IAssignment>(Mutations.Edubridge.CreateAssignment.mutation, Mutations.Edubridge.CreateAssignment.name, { data });
export const closeAssignment = (id: string) => m<IAssignment>(Mutations.Edubridge.CloseAssignment.mutation, Mutations.Edubridge.CloseAssignment.name, { id });
export const declineContribution = (contribution_id: string, reason: string) =>
  m<IContribution>(Mutations.Edubridge.DeclineContribution.mutation, Mutations.Edubridge.DeclineContribution.name, { data: { contribution_id, reason } });

function who() {
  const session = useSessionStore();
  const system = useSystemStore();
  if (!session.username) throw new Error('Пайщик не авторизован');
  return { username: session.username, coopname: system.info.coopname };
}

function number16(): string {
  const rnd = new Uint8Array(8);
  crypto.getRandomValues(rnd);
  return Array.from(rnd).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Экземпляр договора УХД с номером и датой — сначала для прочтения, потом тот же на подпись. */
export interface IContractDraft {
  document: DigitalDocument;
  contract_number: string;
}

/**
 * Договор УХД (3006): генерация с номером/датой. Преподаватель читает документ
 * целиком на шлюзе подключения, и подписывается ровно прочитанный экземпляр.
 */
export async function buildContractDocument(): Promise<IContractDraft> {
  const { username, coopname } = who();
  const contract_number = number16();
  const document = new DigitalDocument();
  await document.generate({ registry_id: Cooperative.Registry.EducationParticipationContract.registry_id, coopname, username, contract_number, contract_created_at: today() });
  return { document, contract_number };
}

/** Первая подпись договора — преподавателя; вторую ставит председатель со стола «Запросы одобрений». */
export async function signContract(prepared?: IContractDraft): Promise<IContract> {
  const { username } = who();
  const { document, contract_number } = prepared ?? (await buildContractDocument());
  await document.sign(username);
  if (!document.signedDocument) throw new Error('Не удалось подписать договор');
  return m<IContract>(Mutations.Edubridge.SignContract.mutation, Mutations.Edubridge.SignContract.name, { data: { document: document.signedDocument, contract_number } });
}

/** Приложение к договору по курсу (3007). */
export async function signAnnex(a: IAssignment, contractNumber: string): Promise<IAssignment> {
  const { username, coopname } = who();
  const doc = new DigitalDocument();
  await doc.generate({
    registry_id: Cooperative.Registry.EducationCourseAnnex.registry_id,
    coopname,
    username,
    contract_number: contractNumber,
    course_title: a.course_title,
    schedule: a.schedule,
    expected_result: a.expected_result,
    period_from: a.period_from,
    period_to: a.period_to,
  });
  await doc.sign(username);
  if (!doc.signedDocument) throw new Error('Не удалось подписать приложение');
  return m<IAssignment>(Mutations.Edubridge.SignAnnex.mutation, Mutations.Edubridge.SignAnnex.name, { data: { assignment_id: a.id, document: doc.signedDocument } });
}

/** Заявление (3008): генерируется бэкендом по черновику, подписывается здесь, подаётся. */
export async function submitContribution(c: IContribution): Promise<IContribution> {
  const { username } = who();
  const generated = await m<{ hash: string; html: string; full_title: string; binary: string }>(Mutations.Edubridge.RidStatement.mutation, Mutations.Edubridge.RidStatement.name, { contribution_id: c.id });
  const doc = new DigitalDocument(generated as never);
  await doc.sign(username);
  if (!doc.signedDocument) throw new Error('Не удалось подписать заявление');
  return m<IContribution>(Mutations.Edubridge.SubmitContribution.mutation, Mutations.Edubridge.SubmitContribution.name, { data: { contribution_id: c.id, document: doc.signedDocument } });
}

/** Акт приёма-передачи (3010) после решения совета. */
export async function signAct(c: IContribution): Promise<IContribution> {
  const { username } = who();
  const generated = await m<{ hash: string; html: string; full_title: string; binary: string }>(Mutations.Edubridge.RidAct.mutation, Mutations.Edubridge.RidAct.name, { contribution_id: c.id });
  const doc = new DigitalDocument(generated as never);
  await doc.sign(username);
  if (!doc.signedDocument) throw new Error('Не удалось подписать акт');
  return m<IContribution>(Mutations.Edubridge.SignAct.mutation, Mutations.Edubridge.SignAct.name, { data: { contribution_id: c.id, document: doc.signedDocument } });
}

/**
 * Вторая подпись председателя: берём тот же акт, что подписал преподаватель
 * (агрегат из реестра документов), и присоединяем подпись с id=2 — без
 * перегенерации. Так же подписываются акты «Благороста» и «Стола заказов».
 */
export async function acceptContributionAsChairman(c: IContribution): Promise<IContribution> {
  const { username } = who();
  const globalStore = useGlobalStore();
  const wif = globalStore.wif?.toString();
  if (!wif) throw new Error('Приватный ключ не установлен');
  const aggregate = await q<{ hash: string; document: any; rawDocument: any }>(Queries.Edubridge.ActSignablePayload.query, Queries.Edubridge.ActSignablePayload.name, { contribution_id: c.id });
  if (!aggregate?.rawDocument) throw new Error('Акт не найден в реестре документов');
  const signer = new Classes.Document(wif);
  const signed = await signer.signDocument(aggregate.rawDocument, username, 2, [aggregate.document]);
  return m<IContribution>(Mutations.Edubridge.AcceptContribution.mutation, Mutations.Edubridge.AcceptContribution.name, { data: { contribution_id: c.id, document: signed } });
}
