/** Добавить курс (черновик) */
export * as CreateCourse from './createCourse'
/** Изменить курс */
export * as UpdateCourse from './updateCourse'
/** Опубликовать, снять с публикации или архивировать курс */
export * as SetCourseStatus from './setCourseStatus'
/** Подписать оферту ЦПП «Образование» со стола */
export * as SignOffer from './signOffer'
/** Добавить обучающегося */
export * as AddLearner from './addLearner'
/** Исправить обучающегося */
export * as UpdateLearner from './updateLearner'
/** Удалить обучающегося */
export * as RemoveLearner from './removeLearner'
/** Заявление о конвертации для подписи */
export * as ConvertStatement from './convertStatement'
/** Получить доступ: конвертация и подписка */
export * as Subscribe from './subscribe'
/** Подписать договор участия в хозяйственной деятельности */
export * as SignContract from './signContract'
/** Подписать приложение к договору по курсу */
export * as SignAnnex from './signAnnex'
/** Подготовить взнос РИД */
export * as DraftContribution from './draftContribution'
/** Заявление о паевом взносе РИД для подписи */
export * as RidStatement from './ridStatement'
/** Подать взнос РИД */
export * as SubmitContribution from './submitContribution'
/** Акт приёма-передачи для подписи */
export * as RidAct from './ridAct'
/** Подписать акт приёма-передачи */
export * as SignAct from './signAct'
/** Назначить преподавателю курс */
export * as CreateAssignment from './createAssignment'
/** Закрыть назначение */
export * as CloseAssignment from './closeAssignment'
/** Отклонить взнос РИД */
export * as DeclineContribution from './declineContribution'
/** Повторить задачу выдачи */
export * as RetryTask from './retryTask'
/** Проверить площадку */
export * as CheckConnector from './checkConnector'
/** Включить/выключить площадку */
export * as SetConnectorEnabled from './setConnectorEnabled'
/** Назначить администратора */
export * as AppointAdmin from './appointAdmin'
/** Снять администратора */
export * as DismissAdmin from './dismissAdmin'
/** Председатель подписал акт — взнос принят */
export * as AcceptContribution from './acceptContribution'
