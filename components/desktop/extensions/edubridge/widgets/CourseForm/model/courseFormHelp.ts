import { t } from '../../../i18n';
/**
 * Пояснения к полям конструктора курса — всплывают у значка «?» рядом с
 * полем. Пишем, что вводить и на что поле влияет: курсы заводят и для
 * школьников, и для взрослых, поэтому примеры даём для обоих.
 */
export const COURSE_FORM_HELP = {
  title: t('edubridge.courseFormHelp.title'),
  section:
    t('edubridge.courseFormHelp.section'),
  level:
    t('edubridge.courseFormHelp.level'),
  schedule: t('edubridge.courseFormHelp.schedule'),
  description: t('edubridge.courseFormHelp.description'),
  syllabus: t('edubridge.courseFormHelp.syllabus'),
  lessonsPerMonth: t('edubridge.courseFormHelp.lessonsPerMonth'),
  lessonMinutes: t('edubridge.courseFormHelp.lessonMinutes'),
  lessonsTotal: t('edubridge.courseFormHelp.lessonsTotal'),
  plannedRate: t('edubridge.courseFormHelp.plannedRate'),
  startsAt: t('edubridge.courseFormHelp.startsAt'),
  guaranteeDays: t('edubridge.courseFormHelp.guaranteeDays'),
  direction: t('edubridge.courseFormHelp.direction'),
  carrier: t('edubridge.courseFormHelp.carrier'),
  skillspaceCourse: t('edubridge.courseFormHelp.skillspaceCourse'),
  skillspaceCourseEmpty: t('edubridge.courseFormHelp.skillspaceCourseEmpty'),
  skillspaceGroup: t('edubridge.courseFormHelp.skillspaceGroup'),
  skillspaceGroupEmpty: t('edubridge.courseFormHelp.skillspaceGroupEmpty'),
  externalRef: t('edubridge.courseFormHelp.externalRef'),
  membershipFee:
    t('edubridge.courseFormHelp.membershipFee'),
  coursePayment: t('edubridge.courseFormHelp.coursePayment'),
} as const;
