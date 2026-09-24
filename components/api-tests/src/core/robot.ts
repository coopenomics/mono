/**
 * Предустановка робота решений совета — то состояние стенда, на которое
 * рассчитывают сценарии: приём пайщика и решения Стола заказов совет решает
 * сразу, без людей (components/boot/src/init/robot-preset.ts).
 *
 * Прежние наборы boot проверяют сам реестр автоматизаций и оставляют его
 * другим: soviet-robot.test.ts перезаписывает записи членов совета и снимает
 * их (disautomate). После них робот голосует лишь за тех, кого наборы не
 * тронули, кворума нет, и выдача Стола заказов ждёт людей. Поэтому каркас
 * возвращает предустановку перед своими наборами — теми же действиями цепи,
 * что и boot.
 */
import { Cooperative } from 'cooptypes'
import { tableRows, transact } from './chain'
import { COOP, DEFAULT_WIF } from './env'

const ROBOT_PERMISSION = 'robot'

/** Типы решений предустановки: приём пайщика и все решения Стола заказов. */
export function presetDecisionTypes(): string[] {
  const registry = Cooperative.Document.decisionTypesRegistry
  return [
    registry.joincoop,
    ...Object.values(registry).filter(info => info.extension === 'market'),
  ].map(info => String(info.type))
}

export async function restoreRobotPreset(): Promise<void> {
  const boards = await tableRows<any>('soviet', COOP, 'boards')
  const board = boards.find(b => String(b.type) === 'soviet')
  if (!board)
    throw new Error('совет кооператива не найден — предустановку робота вернуть нельзя')
  const members: any[] = board.members ?? []
  const chairman = String(members.find(m => String(m.position) === 'chairman')?.username ?? '')
  const voters = members.filter(m => m.is_voting && String(m.username) !== chairman).map(m => String(m.username))
  const types = presetDecisionTypes()

  // Члены совета стенда заведены boot с общим ключом стенда.
  for (const member of [chairman, ...voters]) {
    await transact({ account: member, email: '', wif: DEFAULT_WIF }, [{
      account: 'soviet',
      name: 'automate',
      data: {
        coopname: COOP,
        board_id: Number(board.id),
        member,
        permission_name: ROBOT_PERMISSION,
        vote_types: types,
        follow_rules: [],
        // Протоколы подписывает робот ключом председателя.
        authorize_types: member === chairman ? types : [],
        limit: '0.0000 RUB',
        expires_at: '1970-01-01T00:00:00',
      },
    }])
  }
}
