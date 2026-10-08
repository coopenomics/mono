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

/**
 * Носители, которыми может доставляться доступ при данном направлении:
 * онлайн-платформа — только площадки с API, закрытое сообщество — мессенджеры,
 * очное обучение — очный пропуск. Конструктор курса показывает лишь их,
 * сервер отказывает в любой другой паре.
 */
export const CARRIERS_BY_DIRECTION: Readonly<Record<EduCourseDirection, readonly EduAccessCarrier[]>> = {
  [EduCourseDirection.ONLINE_PLATFORM]: [EduAccessCarrier.SKILLSPACE, EduAccessCarrier.GETCOURSE],
  [EduCourseDirection.CLOSED_COMMUNITY]: [EduAccessCarrier.TELEGRAM, EduAccessCarrier.VK],
  [EduCourseDirection.ONSITE]: [EduAccessCarrier.ONSITE],
};

/** Носители, у которых есть идентификатор курса на площадке. */
export const PLATFORM_CARRIERS: readonly EduAccessCarrier[] = [EduAccessCarrier.SKILLSPACE, EduAccessCarrier.GETCOURSE];

export enum EduCourseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/** Состояние группы (набора) курса. */
export enum EduGroupStatus {
  /** Группа идёт либо набирается. */
  ACTIVE = 'active',
  /** Группа завершена: занятия проведены, подписки закрыты. */
  CLOSED = 'closed',
  /** Группа отменена кооперативом по недобору. */
  CANCELLED = 'cancelled',
}

/** Как доставляется пропуск обучающемуся. */
export enum EduRecipientType {
  EMAIL = 'email',
  TELEGRAM = 'telegram',
  ONSITE = 'onsite',
}

/**
 * За какой срок внесён членский взнос: помесячно либо разом за весь курс.
 * Курс длится столько месяцев, сколько занимает его программа, — год здесь
 * частный случай курса на двенадцать месяцев.
 */
export enum EduEnrollmentPeriod {
  MONTH = 'month',
  COURSE = 'course',
  /** Только у подписок, открытых до взноса за курс; новые так не оформляются. */
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
  /** Отменена с возвратом членского взноса по Положению ЦПП. */
  CANCELLED = 'cancelled',
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

/**
 * Договор УХД преподавателя — двухподписный: преподаватель, затем председатель
 * совета через одобрение (как договор в «Благоросте»).
 */
export enum EduContractStatus {
  /** Подписан преподавателем, ждёт подписи председателя на столе «Запросы одобрений». */
  PENDING_APPROVAL = 'pending_approval',
  /** Подписан обеими сторонами — действует. */
  ACTIVE = 'active',
  /** Председатель отказал — можно подписать заново. */
  DECLINED = 'declined',
  /** Прекращён — с выходом преподавателя из кооператива либо по соглашению сторон; можно подписать заново. */
  TERMINATED = 'terminated',
}

/** Чем закончилось рассмотрение заявления советом, когда решение о приёме не принято. */
export enum EduCouncilOutcome {
  /** Совет отклонил вопрос. */
  DECLINED = 'declined',
  /** Вопрос не набрал голосов в срок и снят с повестки. */
  EXPIRED = 'expired',
}

export enum EduAssignmentStatus {
  /** Преподаватель допущен к курсу — назначение действует с момента создания. */
  ACTIVE = 'active',
  /** Допуск снят: преподавателя убрали из курса. */
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
  /**
   * Материалы занятия приняты на ответственное хранение, идёт гарантийный срок
   * курса. Подписанное заявление держится здесь же и уходит в совет по
   * истечении срока.
   */
  HELD = 'held',
  /** Заявление подписано, взнос в цепи, проект решения у совета. */
  SUBMITTED = 'submitted',
  /** Совет принял решение — ждём подпись преподавателя на акте приёма-передачи. */
  COUNCIL_APPROVED = 'council_approved',
  /** Преподаватель подписал акт — ждём подпись председателя на том же документе. */
  ACT_SIGNED = 'act_signed',
  /** Акт подписан, проводка сделана, право требования в кошельке. */
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

/** Документы взноса результатом работы — по шагам его пути. */
export enum EduContributionDocumentKind {
  /** Заявление о паевом взносе РИД (3008). */
  STATEMENT = 'statement',
  /** Акт передачи материалов на ответственное хранение (3012). */
  STORAGE_ACT = 'storage_act',
  /** Акт приёма-передачи после решения совета. */
  ACT = 'act',
}

/** Строка выписки преподавателя: пришло на паевой взнос или ушло возвратом. */
export enum EduSettlementEntryKind {
  IN = 'in',
  OUT = 'out',
}

/** Состояние строки выписки: зачисление конечно, возврат идёт через совет и выплату. */
export enum EduSettlementEntryStatus {
  /** Результат принят советом, взнос зачислен. */
  ACCEPTED = 'accepted',
  /** Заявление о возврате на рассмотрении совета. */
  COUNCIL_REVIEW = 'council_review',
  /** Совет одобрил, кассир ещё не выплатил. */
  AWAITING_PAYOUT = 'awaiting_payout',
  PAID = 'paid',
  /** Совет отказал либо выплата не состоялась. */
  DECLINED = 'declined',
}

/** Документы возврата паевого взноса преподавателя. */
export enum EduShareReturnDocumentKind {
  /** Заявление о трансляции паевого взноса в Цифровой Кошелёк (3015). */
  TRANSFER_STATEMENT = 'transfer_statement',
  /** Заявление о возврате паевого взноса деньгами (900). */
  RETURN_STATEMENT = 'return_statement',
}
