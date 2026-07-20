/**
 * Действие верификации аккаунта
 */
export * as VerificateAccount from './verificateAccount'

/**
 * Действие отклонения регистрации кандидата советом (отказ в приёме).
 */
export * as DeclineRegistration from './declineRegistration'

/**
 * Действие обновления публичных данных аккаунта
 */
export * as UpdateAccount from './updateAccount'

/**
 * Действие обновления публичных регистрационных данных кооператива
 */
export * as UpdateCoop from './updateCoop'

/**
 * Действие создания нового аккаунта
 */
export * as CreateAccount from './createAccount'

/**
 * Действие регистрации карточки пользователя в кооперативе
 */
export * as RegisterUser from './registerUser'

/**
 * Действие подачи заявления на выход пайщика из кооператива (возврат паевого взноса)
 */
export * as ExitCoop from './exitCoop'

/**
 * Действие регистрации карточки организации в кооперативе
 */
export * as RegisterCooperative from './registerCooperative'

/**
 * Действие замены активного ключа пользователя за подписью системного аккаунта делегатов.
 */
export * as ChangeKey from './changeKey'

/**
 * Действие, которые вызывается системным контрактом для инициализации.
 * @private
 */
export * as Init from './init'

/**
 * Действие добавления пайщика в обход процедуры регистрации.
 * @private
 */
export * as AddUser from './addUser'

/**
 * Действие изменения статуса подключенного кооператива.
 * @private
 */
export * as SetCoopStatus from './setCoopStatus'

/**
 * Удаление кооператива из реестра подключений
 * @private
 */
export * as DeleteCooperative from './deleteCooperative'

/**
 * Включение режима кооперативных участков. Вызывается каскадом из контракта branch.
 * @private
 */
export * as EnableBranches from './enableBranches'

/**
 * Отключение режима кооперативных участков. Вызывается каскадом из контракта branch.
 * @private
 */
export * as DisableBranches from './disableBranches'
