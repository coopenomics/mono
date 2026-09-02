import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  ICatalogInput,
  ICoursesInput,
  ICreateCourseInput,
  ISetCourseStatusInput,
  IUpdateCourseInput,
} from '../model';

export async function fetchCatalog(data: ICatalogInput = {}) {
  const { [Queries.Edubridge.Catalog.name]: result } = await client.Query(Queries.Edubridge.Catalog.query, {
    variables: data,
  });
  return result;
}

export async function fetchCatalogCourse(id: string) {
  const { [Queries.Edubridge.CatalogCourse.name]: result } = await client.Query(Queries.Edubridge.CatalogCourse.query, {
    variables: { id },
  });
  return result;
}

export async function fetchCatalogSubjects() {
  const { [Queries.Edubridge.CatalogSubjects.name]: result } = await client.Query(Queries.Edubridge.CatalogSubjects.query);
  return result;
}

export async function fetchCourses(data: ICoursesInput = {}) {
  const { [Queries.Edubridge.Courses.name]: result } = await client.Query(Queries.Edubridge.Courses.query, {
    variables: data,
  });
  return result;
}

export async function fetchTeacherOptions() {
  const { [Queries.Edubridge.TeacherOptions.name]: result } = await client.Query(Queries.Edubridge.TeacherOptions.query);
  return result;
}

export async function fetchCourse(id: string) {
  const { [Queries.Edubridge.Course.name]: result } = await client.Query(Queries.Edubridge.Course.query, {
    variables: { id },
  });
  return result;
}

export async function createCourse(data: ICreateCourseInput) {
  const { [Mutations.Edubridge.CreateCourse.name]: result } = await client.Mutation(Mutations.Edubridge.CreateCourse.mutation, {
    variables: { data },
  });
  return result;
}

export async function updateCourse(data: IUpdateCourseInput) {
  const { [Mutations.Edubridge.UpdateCourse.name]: result } = await client.Mutation(Mutations.Edubridge.UpdateCourse.mutation, {
    variables: { data },
  });
  return result;
}

export async function setCourseStatus(data: ISetCourseStatusInput) {
  const { [Mutations.Edubridge.SetCourseStatus.name]: result } = await client.Mutation(
    Mutations.Edubridge.SetCourseStatus.mutation,
    { variables: { data } },
  );
  return result;
}
