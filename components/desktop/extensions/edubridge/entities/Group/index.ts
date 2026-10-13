import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Группа (набор) курса — единица расчёта: у группы свои участники, занятия,
 * резерв преподавателям и возвраты. Курс — программа с условиями по умолчанию.
 */
export type IGroup = Queries.Edubridge.CourseGroups.IOutput[typeof Queries.Edubridge.CourseGroups.name][number];
export type ICreateGroupInput = Mutations.Edubridge.CreateGroup.IInput['data'];
export type IUpdateGroupInput = Mutations.Edubridge.UpdateGroup.IInput['data'];

/** Все группы курса — для администратора. */
export async function fetchCourseGroups(course_id: string): Promise<IGroup[]> {
  const { [Queries.Edubridge.CourseGroups.name]: result } = await client.Query(Queries.Edubridge.CourseGroups.query, { variables: { course_id } });
  return result;
}

/** Группы курса с открытым набором — участник записывается в одну из них. */
export async function fetchOpenGroups(course_id: string): Promise<IGroup[]> {
  const { [Queries.Edubridge.OpenGroups.name]: result } = await client.Query(Queries.Edubridge.OpenGroups.query, { variables: { course_id } });
  return result;
}

/** Идущие группы курсов преподавателя — занятие отчитывается для группы. */
export async function fetchMyTeachingGroups(): Promise<IGroup[]> {
  const { [Queries.Edubridge.MyTeachingGroups.name]: result } = await client.Query(Queries.Edubridge.MyTeachingGroups.query);
  return result;
}

export async function createGroup(data: ICreateGroupInput): Promise<IGroup> {
  const { [Mutations.Edubridge.CreateGroup.name]: result } = await client.Mutation(Mutations.Edubridge.CreateGroup.mutation, { variables: { data } });
  return result;
}

/** Завершить группу: расчёты по её подпискам с вышедшим оплаченным сроком закрываются, резерв за занятия без отчёта уходит на кошелёк программы. */
export async function finishGroup(group_id: string): Promise<IGroup> {
  const { [Mutations.Edubridge.FinishGroup.name]: result } = await client.Mutation(Mutations.Edubridge.FinishGroup.mutation, { variables: { group_id } });
  return result;
}

/** Отмена группы по недобору: подписки группы закрываются, взносы возвращаются на паевой; курс и другие группы идут дальше. */
export async function cancelGroupUnderfilled(group_id: string): Promise<number> {
  const { [Mutations.Edubridge.CancelGroupUnderfilled.name]: result } = await client.Mutation(Mutations.Edubridge.CancelGroupUnderfilled.mutation, { variables: { group_id } });
  return result;
}

/** Окна расписания группы и срок на отчёт: календарь занятий перестраивается. */
export type ISetGroupScheduleInput = Mutations.Edubridge.SetGroupSchedule.IInput['data'];
export async function setGroupSchedule(data: ISetGroupScheduleInput): Promise<IGroup> {
  const { [Mutations.Edubridge.SetGroupSchedule.name]: result } = await client.Mutation(Mutations.Edubridge.SetGroupSchedule.mutation, { variables: { data } });
  return result;
}

export async function updateGroup(data: IUpdateGroupInput): Promise<IGroup> {
  const { [Mutations.Edubridge.UpdateGroup.name]: result } = await client.Mutation(Mutations.Edubridge.UpdateGroup.mutation, { variables: { data } });
  return result;
}
