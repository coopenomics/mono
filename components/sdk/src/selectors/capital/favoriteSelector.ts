import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawFavoriteSelector = {
  coopname: true,
  username: true,
  target_type: true,
  target_hash: true,
  title: true,
  parent_hash: true,
  created_at: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalFavorite']> = rawFavoriteSelector

export type favoriteModel = ModelTypes['CapitalFavorite']
export const favoriteSelector = Selector('CapitalFavorite')(rawFavoriteSelector)
export { rawFavoriteSelector }
