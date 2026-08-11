import type { IPublicBranch } from '../model/types'

/**
 * Участок, который пайщик возглавляет как председатель, — или undefined.
 *
 * Председатель привязан к собственному участку и не выбирает его заявлением,
 * поэтому председательство отвечает на вопрос «есть ли у пайщика участок»
 * наравне с привязкой в реестре пайщиков.
 */
export function findChairedBranch(branches: IPublicBranch[], username: string): IPublicBranch | undefined {
  if (!username) return undefined

  return branches.find((branch) => branch.trustee_certificate?.username === username)
}
