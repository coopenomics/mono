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

export interface RobotFollowRule { decision_type: string, follow: string }

/** Совет стенда: номер в цепи, председатель и голосующие члены. */
export async function sovietBoard(): Promise<{ id: number, chairman: string, voters: string[] }> {
  const boards = await tableRows<any>('soviet', COOP, 'boards')
  const board = boards.find(b => String(b.type) === 'soviet')
  if (!board)
    throw new Error('совет кооператива не найден')
  const members: any[] = board.members ?? []
  const chairman = String(members.find(m => String(m.position) === 'chairman')?.username ?? '')
  return {
    id: Number(board.id),
    chairman,
    voters: members.filter(m => m.is_voting && String(m.username) !== chairman).map(m => String(m.username)),
  }
}

/**
 * Делегирование члена совета роботу (soviet::automate) — запись заменяется
 * целиком. Члены совета стенда заведены boot с общим ключом стенда.
 */
export async function automateMember(boardId: number, member: string, d: { vote_types: string[], follow_rules?: RobotFollowRule[], authorize_types?: string[] }): Promise<void> {
  await transact({ account: member, email: '', wif: DEFAULT_WIF }, [{
    account: 'soviet',
    name: 'automate',
    data: {
      coopname: COOP,
      board_id: boardId,
      member,
      permission_name: ROBOT_PERMISSION,
      vote_types: d.vote_types,
      follow_rules: d.follow_rules ?? [],
      authorize_types: d.authorize_types ?? [],
      limit: '0.0000 RUB',
      expires_at: '1970-01-01T00:00:00',
    },
  }])
}

/**
 * Весь совет голосует роботом «сразу» по этим типам решений, протоколы
 * подписывает робот ключом председателя. Без аргумента — предустановка стенда.
 */
export async function automateCouncil(types: string[] = presetDecisionTypes()): Promise<void> {
  const board = await sovietBoard()
  for (const member of [board.chairman, ...board.voters])
    await automateMember(board.id, member, { vote_types: types, authorize_types: member === board.chairman ? types : [] })
}

/** Вернуть предустановку стенда. */
export async function restoreRobotPreset(): Promise<void> {
  await automateCouncil()
}
