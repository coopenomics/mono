import { Cooperative } from 'cooptypes';
import { Classes, Mutations, Queries } from '@coopenomics/sdk';
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

export const RID_TYPE_LABELS: Record<string, string> = {
  lesson_recording: 'Запись занятия',
  methodical_material: 'Методический материал',
  course_program: 'Программа курса',
  assessment_material: 'Контрольные материалы',
  other: 'Другое',
};

export const CONTRIBUTION_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  draft: { label: 'Черновик', variant: 'neutral' },
  submitted: { label: 'На рассмотрении совета', variant: 'info' },
  council_approved: { label: 'Ждёт подписи акта', variant: 'warn' },
  act_signed: { label: 'Ждёт подписи председателя', variant: 'info' },
  accepted: { label: 'Принят', variant: 'pos' },
  declined: { label: 'Отклонён', variant: 'neg' },
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'warn' | 'neutral' }> = {
  draft: { label: 'Ждёт подписи приложения', variant: 'warn' },
  active: { label: 'Действует', variant: 'pos' },
  closed: { label: 'Закрыто', variant: 'neutral' },
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

/** Договор УХД (3006): генерация с номером/датой, подпись, отправка. */
export async function signContract(): Promise<IContract> {
  const { username, coopname } = who();
  const contract_number = number16();
  const doc = new DigitalDocument();
  await doc.generate({ registry_id: Cooperative.Registry.EducationParticipationContract.registry_id, coopname, username, contract_number, contract_created_at: today() });
  await doc.sign(username);
  if (!doc.signedDocument) throw new Error('Не удалось подписать договор');
  return m<IContract>(Mutations.Edubridge.SignContract.mutation, Mutations.Edubridge.SignContract.name, { data: { document: doc.signedDocument, contract_number } });
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
