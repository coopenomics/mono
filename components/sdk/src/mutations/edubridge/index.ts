/** Добавить курс (черновик) */
export * as CreateCourse from './createCourse'
/** Изменить курс */
export * as UpdateCourse from './updateCourse'
/** Отчитаться о проведённом занятии */
export * as ReportLesson from './reportLesson'
/** Снять удерживаемое заявление по рекламации */
export * as RevokeContribution from './revokeContribution'
/** Отменить подписку с возвратом членского взноса */
export * as CancelEnrollment from './cancelEnrollment'
/** Отменить курс по недобору */
export * as CancelCourseUnderfilled from './cancelCourseUnderfilled'
/** Подать расход программы из фонда */
export * as CreateExpense from './createExpense'
/** Задать наценку кооператива */
export * as SetEconomySettings from './setEconomySettings'
/** Задать ставку часа преподавателя */
export * as SetTeacherRate from './setTeacherRate'
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
/** Заявление о паевом взносе РИД для подписи */
export * as RidStatement from './ridStatement'
export * as RidStorageAct from './ridStorageAct'
/** Подать взнос РИД */
export * as HoldContribution from './holdContribution'
export * as TerminateContract from './terminateContract'
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
export * as SetConnectorCredentials from './setConnectorCredentials'
/** Назначить администратора */
export * as AppointAdmin from './appointAdmin'
/** Снять администратора */
export * as DismissAdmin from './dismissAdmin'
/** Председатель подписал акт — взнос принят */
export * as AcceptContribution from './acceptContribution'

/** Возврат остатка кошелька программы в паевой взнос: заявление пайщика и согласование кооперативом. */
export * as RequestReturn from './requestReturn'
export * as ApproveReturn from './approveReturn'
export * as DeclineReturn from './declineReturn'
