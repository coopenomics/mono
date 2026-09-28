/**
 * Подготовка стенда перед наборами каркаса: вернуть то, что прежние наборы
 * boot, идущие в том же прогоне раньше, оставили другим (см. core/robot.ts),
 * и завести то, чего засев стенда не даёт (реквизиты отчётов).
 */
import { restoreRobotPreset } from '../core/robot'
import { ensureReportRequisites } from './report-requisites'

export default async function setup(): Promise<void> {
  await restoreRobotPreset()
  await ensureReportRequisites()
}
