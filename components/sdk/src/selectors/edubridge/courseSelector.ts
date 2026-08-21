import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawCatalogCourseSelector = {
  id: true,
  title: true,
  subject: true,
  grade: true,
  description: true,
  syllabus: true,
  schedule: true,
  teacher_username: true,
  fee_month: true,
  fee_year: true,
}

const _validateCatalogCourse: MakeAllFieldsRequired<ValueTypes['EduCatalogCourse']> = rawCatalogCourseSelector

export const eduCatalogCourseSelector = Selector('EduCatalogCourse')(rawCatalogCourseSelector)

export const eduCatalogCoursesPaginationResultSelector = Selector('PaginatedEduCatalogCoursesPaginationResult')({
  items: rawCatalogCourseSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
})

const rawCourseSelector = {
  ...rawCatalogCourseSelector,
  direction: true,
  carrier: true,
  external_ref: true,
  external_title_seen: true,
  status: true,
  sort_order: true,
  created_at: true,
  updated_at: true,
}

const _validateCourse: MakeAllFieldsRequired<ValueTypes['EduCourse']> = rawCourseSelector

export const eduCourseSelector = Selector('EduCourse')(rawCourseSelector)

export const eduCoursesPaginationResultSelector = Selector('PaginatedEduCoursesPaginationResult')({
  items: rawCourseSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
})

const rawSubjectSelector = { subject: true, grades: true }
const _validateSubject: MakeAllFieldsRequired<ValueTypes['EduCatalogSubject']> = rawSubjectSelector
export const eduCatalogSubjectSelector = Selector('EduCatalogSubject')(rawSubjectSelector)
