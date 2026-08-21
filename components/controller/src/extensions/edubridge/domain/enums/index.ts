/** Статусы «Образовательного моста». Канон платформы: статус — всегда enum. */

/** Носитель доступа к курсу (ключ коннектора фабрики). */
export enum EduAccessCarrier {
  SKILLSPACE = 'skillspace',
  GETCOURSE = 'getcourse',
  TELEGRAM = 'telegram',
  VK = 'vk',
  ONSITE = 'onsite',
}

/** Внутренний тип направления курса; посетителю не показывается. */
export enum EduCourseDirection {
  ONLINE_PLATFORM = 'online_platform',
  CLOSED_COMMUNITY = 'closed_community',
  ONSITE = 'onsite',
}

export enum EduCourseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/** Как доставляется пропуск обучающемуся. */
export enum EduRecipientType {
  EMAIL = 'email',
  TELEGRAM = 'telegram',
  ONSITE = 'onsite',
}

export enum EduEnrollmentPeriod {
  MONTH = 'month',
  YEAR = 'year',
}

export enum EduEnrollmentStatus {
  /** Заявление подписано, ждём подтверждения цепи. */
  PENDING = 'pending',
  /** Подписка активна, доступ выдан или выдаётся. */
  ACTIVE = 'active',
  /** Период истёк, доступ отозван или отзывается. */
  EXPIRED = 'expired',
  /** Отозвана досрочно (выход из кооператива). */
  REVOKED = 'revoked',
}

/** Состояние доступа на площадке по связке «обучающийся + курс». */
export enum EduAccessState {
  NONE = 'none',
  PENDING = 'pending',
  GRANTED = 'granted',
  REVOKED = 'revoked',
  NEEDS_ATTENTION = 'needs_attention',
}

export enum EduAccessTaskKind {
  GRANT = 'grant',
  REVOKE = 'revoke',
}

/** Статусы задачи outbox выдачи/отзыва доступа. */
export enum EduAccessTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  DONE = 'done',
  FAILED = 'failed',
  NEEDS_ATTENTION = 'needs_attention',
}

export enum EduConnectorHealth {
  UNKNOWN = 'unknown',
  OK = 'ok',
  FAILING = 'failing',
  LICENSE_LIMIT = 'license_limit',
}

export enum EduAssignmentStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

export enum EduRidType {
  LESSON_RECORDING = 'lesson_recording',
  METHODICAL_MATERIAL = 'methodical_material',
  COURSE_PROGRAM = 'course_program',
  ASSESSMENT_MATERIAL = 'assessment_material',
  OTHER = 'other',
}

export enum EduContributionStatus {
  DRAFT = 'draft',
  /** Заявление подписано, взнос в цепи, проект решения у совета. */
  SUBMITTED = 'submitted',
  /** Совет принял решение — ждём подпись преподавателя на акте приёма-передачи. */
  COUNCIL_APPROVED = 'council_approved',
  /** Акт подписан, проводка сделана, право требования в кошельке. */
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}
