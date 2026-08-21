import type * as Ano from '../../../interfaces/ano'
import * as ContractNames from '../../../common/names'

/**
 * Имя таблицы
 */
export const tableName = 'endorsements'

/**
 * Таблица хранится в {@link ContractNames._ano | области памяти контракта}.
 */
export const scope = ContractNames._ano

/**
 * @interface
 * Заверения всех уровней цепочки доверия: кто кого признаёт вправе заверять
 * и каким ключом.
 */
export type IEndorsement = Ano.IEndorsement
