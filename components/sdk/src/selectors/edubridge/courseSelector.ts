import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawCatalogCourseSelector = {
  id: true,
  title: true,
  section_id: true,
  section_title: true,
  level_id: true,
  level_title: true,
  description: true,
  syllabus: true,
  schedule: true,
  image_url: true,
  teacher_usernames: true,
  lessons_per_month: true,
  lessons_total: true,
  lesson_minutes: true,
  starts_at: true,
  fee_month: true,
  course_months: true,
  fee_course: true,
  fee_course_base: true,
  course_discount_amount: true,
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
  planned_hourly_rate: true,
  course_payment_enabled: true,
  course_discount_percent: true,
  guarantee_days: true,
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


const rawTeacherSelector = {
  username: true,
  hourly_rate: true,
  display_name: true,
  avatar_url: true,
  contract_number: true,
  contract_status: true,
  signed_at: true,
  approved_at: true,
  assignments_total: true,
  assignments_active: true,
}
const _validateTeacher: MakeAllFieldsRequired<ValueTypes['EduTeacher']> = rawTeacherSelector
export const eduTeacherSelector = Selector('EduTeacher')(rawTeacherSelector)

const rawTeacherOptionSelector = { username: true, display_name: true, contract_number: true, signed_at: true }
const _validateTeacherOption: MakeAllFieldsRequired<ValueTypes['EduTeacherOption']> = rawTeacherOptionSelector
export const eduTeacherOptionSelector = Selector('EduTeacherOption')(rawTeacherOptionSelector)

const rawPlatformGroupSelector = { id: true, name: true }
const _validatePlatformGroup: MakeAllFieldsRequired<ValueTypes['EduPlatformGroup']> = rawPlatformGroupSelector
const rawPlatformCourseSelector = { id: true, name: true, groups: rawPlatformGroupSelector }
const _validatePlatformCourse: MakeAllFieldsRequired<ValueTypes['EduPlatformCourse']> = rawPlatformCourseSelector
export const eduPlatformCourseSelector = Selector('EduPlatformCourse')(rawPlatformCourseSelector)

const rawApprovalSelector = { approval_hash: true, username: true, action: true, title: true, created_at: true }
const _validateApproval: MakeAllFieldsRequired<ValueTypes['EduApproval']> = rawApprovalSelector
export const eduApprovalSelector = Selector('EduApproval')(rawApprovalSelector)
