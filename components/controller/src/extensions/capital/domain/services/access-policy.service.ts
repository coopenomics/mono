import { IssueStatus } from '../enums/issue-status.enum';

/**
 * Типы ролей пользователей для матрицы доступа к проектам и задачам
 */
export enum UserRole {
  MASTER = 'master', // Мастер проекта
  SUBMASTER = 'submaster', // Ответственный (исполнитель)
  CREATOR = 'creator', // Создатель задачи
  AUTHOR = 'author', // Автор проекта
  CONTRIBUTOR = 'contributor', // Участник проекта
  BOARD_MEMBER = 'board_member', // Член совета
  GUEST = 'guest', // Гость/неавторизованный
}

/**
 * Типы действий над задачами
 */
export enum IssueAction {
  ASSIGN_SUBMASTER = 'assign_submaster', // Назначение ответственного
  ASSIGN_CREATOR = 'assign_creator', // Назначение исполнителей
  EDIT_ISSUE = 'edit_issue', // Редактирование задачи
  CHANGE_STATUS = 'change_status', // Изменение статуса
  SET_DONE = 'set_done', // Установка статуса DONE
  SET_ON_REVIEW = 'set_on_review', // Установка статуса ON_REVIEW
  SET_ESTIMATE = 'set_estimate', // Установка оценки (estimate)
  SET_PRIORITY = 'set_priority', // Установка приоритета
  DELETE_ISSUE = 'delete_issue', // Удаление задачи
  CREATE_REQUIREMENT = 'create_requirement', // Создание требования
  EDIT_REQUIREMENT = 'edit_requirement', // Редактирование требования (story)
  DELETE_REQUIREMENT = 'delete_requirement', // Удаление требования
  COMPLETE_REQUIREMENT = 'complete_requirement', // Выполнение требования
}

/**
 * Типы действий над проектами
 */
export enum ProjectAction {
  EDIT_PROJECT = 'edit_project', // Редактирование проекта
  MANAGE_ISSUES = 'manage_issues', // Управление задачами
  CHANGE_PROJECT_STATUS = 'change_project_status', // Изменение статуса проекта
  DELETE_PROJECT = 'delete_project', // Удаление проекта
  SET_MASTER = 'set_master', // Назначение мастера
  MANAGE_AUTHORS = 'manage_authors', // Управление авторами
  SET_PLAN = 'set_plan', // Установка плана
  CREATE_REQUIREMENT = 'create_requirement', // Создание требования
  EDIT_REQUIREMENT = 'edit_requirement', // Редактирование требования (story)
  DELETE_REQUIREMENT = 'delete_requirement', // Удаление требования
  COMPLETE_REQUIREMENT = 'complete_requirement', // Выполнение требования
}

/**
 * Типы ролей пользователей для проектов
 */
export enum ProjectUserRole {
  GUEST = 'guest', // Гость/неавторизованный
  CONTRIBUTOR = 'contributor', // Участник проекта
  AUTHOR = 'author', // Автор проекта
  MASTER = 'master', // Мастер проекта
  CHAIRMAN = 'chairman', // Председатель совета
  BOARD_MEMBER = 'board_member', // Член совета
}

/**
 * Матрица доступа: роль -> действие -> разрешение
 */
export const PERMISSION_MATRIX: Record<UserRole, Record<IssueAction, boolean>> = {
  [UserRole.MASTER]: {
    [IssueAction.ASSIGN_SUBMASTER]: true,
    [IssueAction.ASSIGN_CREATOR]: true,
    [IssueAction.EDIT_ISSUE]: true,
    [IssueAction.CHANGE_STATUS]: true,
    [IssueAction.SET_DONE]: true,
    [IssueAction.SET_ON_REVIEW]: true,
    [IssueAction.SET_ESTIMATE]: true, // Только мастер может устанавливать оценку
    [IssueAction.SET_PRIORITY]: true, // Только мастер может устанавливать приоритет
    [IssueAction.DELETE_ISSUE]: true,
    [IssueAction.CREATE_REQUIREMENT]: true,
    [IssueAction.EDIT_REQUIREMENT]: true,
    [IssueAction.DELETE_REQUIREMENT]: true,
    [IssueAction.COMPLETE_REQUIREMENT]: true,
  },
  [UserRole.SUBMASTER]: {
    [IssueAction.ASSIGN_SUBMASTER]: false,
    [IssueAction.ASSIGN_CREATOR]: false,
    [IssueAction.EDIT_ISSUE]: true,
    [IssueAction.CHANGE_STATUS]: true,
    [IssueAction.SET_DONE]: false,
    [IssueAction.SET_ON_REVIEW]: true,
    [IssueAction.SET_ESTIMATE]: false,
    [IssueAction.SET_PRIORITY]: false,
    [IssueAction.DELETE_ISSUE]: false,
    [IssueAction.CREATE_REQUIREMENT]: false,
    [IssueAction.EDIT_REQUIREMENT]: false,
    [IssueAction.DELETE_REQUIREMENT]: false,
    [IssueAction.COMPLETE_REQUIREMENT]: false,
  },
  [UserRole.CREATOR]: {
    [IssueAction.ASSIGN_SUBMASTER]: false,
    [IssueAction.ASSIGN_CREATOR]: false,
    [IssueAction.EDIT_ISSUE]: true, // Исполнители могут редактировать текст задачи
    [IssueAction.CHANGE_STATUS]: false, // Только первый исполнитель (SUBMASTER) может двигать статусы
    [IssueAction.SET_DONE]: false,
    [IssueAction.SET_ON_REVIEW]: false,
    [IssueAction.SET_ESTIMATE]: false,
    [IssueAction.SET_PRIORITY]: false,
    [IssueAction.DELETE_ISSUE]: false,
    [IssueAction.CREATE_REQUIREMENT]: false,
    [IssueAction.EDIT_REQUIREMENT]: false,
    [IssueAction.DELETE_REQUIREMENT]: false,
    [IssueAction.COMPLETE_REQUIREMENT]: false,
  },
  [UserRole.AUTHOR]: {
    [IssueAction.ASSIGN_SUBMASTER]: false,
    [IssueAction.ASSIGN_CREATOR]: false,
    [IssueAction.EDIT_ISSUE]: false,
    [IssueAction.CHANGE_STATUS]: false, // Автор не может управлять статусами задач
    [IssueAction.SET_DONE]: false,
    [IssueAction.SET_ON_REVIEW]: false,
    [IssueAction.SET_ESTIMATE]: false,
    [IssueAction.SET_PRIORITY]: false,
    [IssueAction.DELETE_ISSUE]: false,
    [IssueAction.CREATE_REQUIREMENT]: true,
    [IssueAction.EDIT_REQUIREMENT]: true,
    [IssueAction.DELETE_REQUIREMENT]: true,
    [IssueAction.COMPLETE_REQUIREMENT]: false,
  },
  [UserRole.CONTRIBUTOR]: {
    [IssueAction.ASSIGN_SUBMASTER]: false,
    [IssueAction.ASSIGN_CREATOR]: false,
    [IssueAction.EDIT_ISSUE]: false,
    [IssueAction.CHANGE_STATUS]: false, // Обычные участники не могут двигать статусы задач
    [IssueAction.SET_DONE]: false,
    [IssueAction.SET_ON_REVIEW]: false,
    [IssueAction.SET_ESTIMATE]: false,
    [IssueAction.SET_PRIORITY]: false,
    [IssueAction.DELETE_ISSUE]: false,
    [IssueAction.CREATE_REQUIREMENT]: false,
    [IssueAction.EDIT_REQUIREMENT]: false,
    [IssueAction.DELETE_REQUIREMENT]: false,
    [IssueAction.COMPLETE_REQUIREMENT]: false,
  },
  [UserRole.BOARD_MEMBER]: {
    [IssueAction.ASSIGN_SUBMASTER]: false, // Члены совета не могут назначать исполнителей
    [IssueAction.ASSIGN_CREATOR]: false,
    [IssueAction.EDIT_ISSUE]: true,
    [IssueAction.CHANGE_STATUS]: true,
    [IssueAction.SET_DONE]: true,
    [IssueAction.SET_ON_REVIEW]: true,
    [IssueAction.SET_ESTIMATE]: false, // Только мастер может устанавливать оценку
    [IssueAction.SET_PRIORITY]: false, // Только мастер может устанавливать приоритет
    [IssueAction.DELETE_ISSUE]: false, // Только chairman может удалять
    [IssueAction.CREATE_REQUIREMENT]: false,
    [IssueAction.EDIT_REQUIREMENT]: false,
    [IssueAction.DELETE_REQUIREMENT]: false,
    [IssueAction.COMPLETE_REQUIREMENT]: false,
  },
  [UserRole.GUEST]: {
    [IssueAction.ASSIGN_SUBMASTER]: false,
    [IssueAction.ASSIGN_CREATOR]: false,
    [IssueAction.EDIT_ISSUE]: false,
    [IssueAction.CHANGE_STATUS]: false,
    [IssueAction.SET_DONE]: false,
    [IssueAction.SET_ON_REVIEW]: false,
    [IssueAction.SET_ESTIMATE]: false,
    [IssueAction.SET_PRIORITY]: false,
    [IssueAction.DELETE_ISSUE]: false,
    [IssueAction.CREATE_REQUIREMENT]: false,
    [IssueAction.EDIT_REQUIREMENT]: false,
    [IssueAction.DELETE_REQUIREMENT]: false,
    [IssueAction.COMPLETE_REQUIREMENT]: false,
  },
};

/**
 * Матрица переходов статусов: текущий статус -> новый статус -> роль -> разрешение
 */
export const STATUS_TRANSITION_MATRIX: Record<IssueStatus, Record<IssueStatus, Record<UserRole, boolean>>> = {
  [IssueStatus.BACKLOG]: {
    [IssueStatus.BACKLOG]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true,
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.TODO]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true,
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.IN_PROGRESS]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true, // Ответственный исполнитель может сразу начать работу
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.ON_REVIEW]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true, // Ответственный исполнитель может сразу отправить на проверку
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.DONE]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.CANCELED]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
  },
  [IssueStatus.TODO]: {
    [IssueStatus.BACKLOG]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.TODO]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true,
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.IN_PROGRESS]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true,
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.ON_REVIEW]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true, // Ответственный исполнитель может отправить задачу на проверку из TODO
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.DONE]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.CANCELED]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
  },
  [IssueStatus.IN_PROGRESS]: {
    [IssueStatus.BACKLOG]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.TODO]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true,
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.IN_PROGRESS]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true,
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.ON_REVIEW]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true, // Ответственный может отправить на проверку
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.DONE]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false, // Ответственный НЕ может закрыть задачу
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.CANCELED]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false, // Ответственный НЕ может отменить задачу из работы
      [UserRole.CREATOR]: true,
      [UserRole.AUTHOR]: true,
      [UserRole.CONTRIBUTOR]: true,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
  },
  [IssueStatus.ON_REVIEW]: {
    [IssueStatus.BACKLOG]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.TODO]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.IN_PROGRESS]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true, // Ответственный может вернуть в работу
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.ON_REVIEW]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: true,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.DONE]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.CANCELED]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
  },
  [IssueStatus.DONE]: {
    [IssueStatus.BACKLOG]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.TODO]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.IN_PROGRESS]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.ON_REVIEW]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.DONE]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.CANCELED]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
  },
  [IssueStatus.CANCELED]: {
    [IssueStatus.BACKLOG]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.TODO]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.IN_PROGRESS]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.ON_REVIEW]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.DONE]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
    [IssueStatus.CANCELED]: {
      [UserRole.MASTER]: true,
      [UserRole.SUBMASTER]: false,
      [UserRole.CREATOR]: false,
      [UserRole.AUTHOR]: false,
      [UserRole.CONTRIBUTOR]: false,
      [UserRole.BOARD_MEMBER]: true,
      [UserRole.GUEST]: false,
    },
  },
};

/**
 * Матрица доступа к проектам: роль -> действие -> разрешение
 */
export const PROJECT_PERMISSION_MATRIX: Record<ProjectUserRole, Record<ProjectAction, boolean>> = {
  [ProjectUserRole.GUEST]: {
    [ProjectAction.EDIT_PROJECT]: false,
    [ProjectAction.MANAGE_ISSUES]: false,
    [ProjectAction.CHANGE_PROJECT_STATUS]: false,
    [ProjectAction.DELETE_PROJECT]: false,
    [ProjectAction.SET_MASTER]: false,
    [ProjectAction.MANAGE_AUTHORS]: false,
    [ProjectAction.SET_PLAN]: false,
    [ProjectAction.CREATE_REQUIREMENT]: false,
    [ProjectAction.EDIT_REQUIREMENT]: false,
    [ProjectAction.DELETE_REQUIREMENT]: false,
    [ProjectAction.COMPLETE_REQUIREMENT]: false,
  },
  [ProjectUserRole.AUTHOR]: {
    [ProjectAction.EDIT_PROJECT]: true, // Соавтор (сегмент is_author): карточка проекта/компонента
    [ProjectAction.MANAGE_ISSUES]: false, // Автор не может управлять задачами (только Мастер)
    [ProjectAction.CHANGE_PROJECT_STATUS]: false,
    [ProjectAction.DELETE_PROJECT]: false,
    [ProjectAction.SET_MASTER]: false,
    [ProjectAction.MANAGE_AUTHORS]: false,
    [ProjectAction.SET_PLAN]: false,
    [ProjectAction.CREATE_REQUIREMENT]: true,
    [ProjectAction.EDIT_REQUIREMENT]: true,
    [ProjectAction.DELETE_REQUIREMENT]: true,
    [ProjectAction.COMPLETE_REQUIREMENT]: false,
  },
  [ProjectUserRole.CONTRIBUTOR]: {
    [ProjectAction.EDIT_PROJECT]: false,
    [ProjectAction.MANAGE_ISSUES]: false, // Участник не может управлять задачами (только Мастер)
    [ProjectAction.CHANGE_PROJECT_STATUS]: false,
    [ProjectAction.DELETE_PROJECT]: false,
    [ProjectAction.SET_MASTER]: false,
    [ProjectAction.MANAGE_AUTHORS]: false,
    [ProjectAction.SET_PLAN]: false,
    [ProjectAction.CREATE_REQUIREMENT]: false,
    [ProjectAction.EDIT_REQUIREMENT]: false,
    [ProjectAction.DELETE_REQUIREMENT]: false,
    [ProjectAction.COMPLETE_REQUIREMENT]: false,
  },
  [ProjectUserRole.MASTER]: {
    [ProjectAction.EDIT_PROJECT]: true,
    [ProjectAction.MANAGE_ISSUES]: true,
    [ProjectAction.CHANGE_PROJECT_STATUS]: false, // Только chairman может менять статус проекта
    [ProjectAction.DELETE_PROJECT]: false,
    [ProjectAction.SET_MASTER]: false,
    [ProjectAction.MANAGE_AUTHORS]: true,
    [ProjectAction.SET_PLAN]: true,
    [ProjectAction.CREATE_REQUIREMENT]: true,
    [ProjectAction.EDIT_REQUIREMENT]: true,
    [ProjectAction.DELETE_REQUIREMENT]: true,
    [ProjectAction.COMPLETE_REQUIREMENT]: true,
  },
  [ProjectUserRole.CHAIRMAN]: {
    [ProjectAction.EDIT_PROJECT]: true,
    [ProjectAction.MANAGE_ISSUES]: true,
    [ProjectAction.CHANGE_PROJECT_STATUS]: true,
    [ProjectAction.DELETE_PROJECT]: true,
    [ProjectAction.SET_MASTER]: true,
    [ProjectAction.MANAGE_AUTHORS]: true,
    [ProjectAction.SET_PLAN]: true,
    [ProjectAction.CREATE_REQUIREMENT]: true,
    [ProjectAction.EDIT_REQUIREMENT]: true,
    [ProjectAction.DELETE_REQUIREMENT]: true,
    [ProjectAction.COMPLETE_REQUIREMENT]: true,
  },
  [ProjectUserRole.BOARD_MEMBER]: {
    [ProjectAction.EDIT_PROJECT]: true, // Члены совета имеют полные права
    [ProjectAction.MANAGE_ISSUES]: true,
    [ProjectAction.CHANGE_PROJECT_STATUS]: true,
    [ProjectAction.DELETE_PROJECT]: true,
    [ProjectAction.SET_MASTER]: true,
    [ProjectAction.MANAGE_AUTHORS]: true,
    [ProjectAction.SET_PLAN]: true,
    [ProjectAction.CREATE_REQUIREMENT]: false,
    [ProjectAction.EDIT_REQUIREMENT]: false,
    [ProjectAction.DELETE_REQUIREMENT]: false,
    [ProjectAction.COMPLETE_REQUIREMENT]: false,
  },
};

/**
 * Сервис политик доступа к задачам
 *
 * Все проверки прав работают по UNION-семантике: пользователь может одновременно
 * нести несколько ролей (например, член совета + соавтор), и итоговое разрешение —
 * это OR по всем его ролям. Так лечится регрессия, при которой board_member
 * перебивал project-specific роль и обнулял её права.
 */
export class IssueAccessPolicyService {
  /**
   * Проверяет, есть ли у пользователя разрешение на действие.
   * UNION по ролям: достаточно одной роли с allow=true.
   */
  hasPermission(roles: Iterable<UserRole>, action: IssueAction): boolean {
    for (const role of roles) {
      if (PERMISSION_MATRIX[role]?.[action]) return true;
    }
    return false;
  }

  /**
   * Проверяет разрешение на переход между статусами.
   * UNION по ролям: достаточно одной роли, для которой переход разрешён.
   */
  canTransitionStatus(roles: Iterable<UserRole>, currentStatus: IssueStatus, newStatus: IssueStatus): boolean {
    if (currentStatus === newStatus) {
      return true; // Можно "перейти" в тот же статус
    }

    const transitions = STATUS_TRANSITION_MATRIX[currentStatus];
    if (!transitions) {
      return false;
    }

    const newStatusTransitions = transitions[newStatus];
    if (!newStatusTransitions) {
      return false;
    }

    for (const role of roles) {
      if (newStatusTransitions[role]) return true;
    }
    return false;
  }

  /**
   * Проверяет, есть ли у пользователя разрешение на действие над проектом.
   * UNION по ролям.
   */
  hasProjectPermission(roles: Iterable<ProjectUserRole>, action: ProjectAction): boolean {
    for (const role of roles) {
      if (PROJECT_PERMISSION_MATRIX[role]?.[action]) return true;
    }
    return false;
  }

  /**
   * Получает список допустимых статусов для перехода из текущего статуса.
   * UNION по ролям: статус попадает в список, если хотя бы одна роль его разрешает.
   */
  getAllowedStatusTransitions(roles: Iterable<UserRole>, currentStatus: IssueStatus): IssueStatus[] {
    const transitions = STATUS_TRANSITION_MATRIX[currentStatus];
    if (!transitions) {
      return [];
    }

    const rolesArr = [...roles];
    const allowedStatuses: IssueStatus[] = [];

    for (const [newStatus, rolePermissions] of Object.entries(transitions)) {
      if (newStatus === currentStatus) {
        continue;
      }

      const isAllowed = rolesArr.some((r) => rolePermissions[r]);
      if (isAllowed) {
        allowedStatuses.push(newStatus as IssueStatus);
      }
    }

    return allowedStatuses;
  }
}
