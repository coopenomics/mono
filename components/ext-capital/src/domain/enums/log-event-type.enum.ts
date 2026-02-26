/**
 * Типы событий в системе логирования CAPITAL
 * Каждый тип представляет отдельное действие, которое логируется в системе
 */
export enum LogEventType {
  /** Добавлен соавтор в проект/компонент */
  AUTHOR_ADDED = 'author_added',

  /** Создан проект */
  PROJECT_CREATED = 'project_created',

  /** Создан компонент (если есть родительский project_hash) */
  COMPONENT_CREATED = 'component_created',

  /** Получен коммит исполнителя */
  COMMIT_RECEIVED = 'commit_received',

  /** Получена инвестиция в компонент */
  INVESTMENT_RECEIVED = 'investment_received',

  /** Назначен мастер на проект */
  PROJECT_MASTER_ASSIGNED = 'project_master_assigned',

  /** Назначен мастер на компонент */
  COMPONENT_MASTER_ASSIGNED = 'component_master_assigned',

  /** Получен взнос результатом на сумму */
  RESULT_CONTRIBUTION_RECEIVED = 'result_contribution_received',

  /** Участник импортирован */
  CONTRIBUTOR_IMPORTED = 'contributor_imported',

  /** Участник зарегистрирован */
  CONTRIBUTOR_REGISTERED = 'contributor_registered',

  /** Проект отредактирован */
  PROJECT_EDITED = 'project_edited',

  /** План проекта установлен */
  PROJECT_PLAN_SET = 'project_plan_set',

  /** Проект запущен */
  PROJECT_STARTED = 'project_started',

  /** Проект открыт для инвестиций */
  PROJECT_OPENED = 'project_opened',

  /** Проект закрыт для инвестиций */
  PROJECT_CLOSED = 'project_closed',

  /** Проект остановлен */
  PROJECT_STOPPED = 'project_stopped',

  /** Проект удален */
  PROJECT_DELETED = 'project_deleted',

  /** Участник присоединен к проекту */
  CONTRIBUTOR_JOINED = 'contributor_joined',

  /** Инвестиция в программу получена */
  PROGRAM_INVESTMENT_RECEIVED = 'program_investment_received',

  /** Средства аллоцированы в проект */
  FUNDS_ALLOCATED = 'funds_allocated',

  /** Средства деаллоцированы из проекта */
  FUNDS_DEALLOCATED = 'funds_deallocated',

  /** Имущественный взнос в проект получен */
  PROJECT_PROPERTY_RECEIVED = 'project_property_received',

  /** Имущественный взнос в программу получен */
  PROGRAM_PROPERTY_RECEIVED = 'program_property_received',

  /** Сегмент обновлен */
  SEGMENT_REFRESHED = 'segment_refreshed',

  /** Ссуда создана */
  DEBT_CREATED = 'debt_created',

  /** Расход создан */
  EXPENSE_CREATED = 'expense_created',

  /** План расходов расширен */
  EXPENSES_EXPANDED = 'expenses_expanded',

  /** Членские взносы в проект зарегистрированы */
  PROJECT_FUNDED = 'project_funded',

  /** Доли в проекте обновлены */
  PROJECT_REFRESHED = 'project_refreshed',

  /** Членские взносы в программу зарегистрированы */
  PROGRAM_FUNDED = 'program_funded',

  /** Доли в программе обновлены */
  PROGRAM_REFRESHED = 'program_refreshed',

  /** Голосование начато */
  VOTING_STARTED = 'voting_started',

  /** Голос подан */
  VOTE_SUBMITTED = 'vote_submitted',

  /** Голосование завершено */
  VOTING_COMPLETED = 'voting_completed',

  /** Голоса подсчитаны */
  VOTES_CALCULATED = 'votes_calculated',

  /** Результат внесен */
  RESULT_PUSHED = 'result_pushed',

  /** Сегмент конвертирован */
  SEGMENT_CONVERTED = 'segment_converted',

  /** Возврат из проекта выполнен */
  PROJECT_WITHDRAWAL = 'project_withdrawal',

  /** Возврат из программы выполнен */
  PROGRAM_WITHDRAWAL = 'program_withdrawal',

  /** Участник отредактирован */
  CONTRIBUTOR_EDITED = 'contributor_edited',

  /** Создана история (требование) */
  STORY_CREATED = 'story_created',

  /** История обновлена */
  STORY_UPDATED = 'story_updated',

  /** История удалена */
  STORY_DELETED = 'story_deleted',

  /** Создана задача */
  ISSUE_CREATED = 'issue_created',

  /** Задача обновлена */
  ISSUE_UPDATED = 'issue_updated',

  /** Задача удалена */
  ISSUE_DELETED = 'issue_deleted',

  /** Создан цикл */
  CYCLE_CREATED = 'cycle_created',
}
