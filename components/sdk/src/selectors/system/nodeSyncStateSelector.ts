import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import type { ValueTypes } from '../../zeus/index'
import { Selector } from '../../zeus/index'

// Селектор состояния синхронизации узла кооператива с цепью
export const rawNodeSyncStateSelector = {
  status: true,
  outage: true,
  current_block_num: true,
  head_block_num: true,
  lag_blocks: true,
  catch_up_blocks_per_second: true,
  estimated_seconds_remaining: true,
  cursor_updated_at: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['NodeSyncState']> = rawNodeSyncStateSelector

export const nodeSyncStateSelector = Selector('NodeSyncState')(rawNodeSyncStateSelector)
