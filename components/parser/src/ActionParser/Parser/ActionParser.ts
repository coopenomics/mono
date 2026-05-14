import type { Database } from '../../Database'
import { publishEvent } from '../../RedisNotifier'
import type { EosioShipReaderResolved, IAction } from '../../Types'
import { subsribedActions } from '../../config'
import { ActionParserFactory } from '../Factory/ActionFactory'

export async function ActionsParser(db: Database, reader: EosioShipReaderResolved) {
  const { actions$ } = reader

  // См. DeltaParser.ts — тот же контракт: Observer с error/complete хуками
  // + try/catch внутри next, чтобы одно плохое событие не рвало весь поток.
  actions$.subscribe({
    next: async (action: IAction) => {
      try {
        console.log(`\nACTION - account: ${action.account}, name: ${action.name}, authorization: ${JSON.stringify(action.authorization)}, data: ${JSON.stringify(action.data)}`)

        const parser = ActionParserFactory.create(action.account, action.name)
        if (parser) {
          await parser.process(db, action)
          await publishEvent('action', action)
        }
      } catch (err) {
        console.error(`Action handler error (${action.account}::${action.name}):`, err)
      }
    },
    error: (err) => {
      console.error('Action stream FATAL — ship-reader разорвался, требуется рестарт:', err)
      process.exit(1)
    },
    complete: () => {
      console.warn('Action stream completed — ship-reader закрыл соединение')
      process.exit(0)
    },
  })

  console.log('Подписка на действия активирована')
}
