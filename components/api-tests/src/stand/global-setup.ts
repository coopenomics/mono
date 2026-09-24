/**
 * Подготовка стенда перед наборами каркаса: вернуть то, что прежние наборы
 * boot, идущие в том же прогоне раньше, оставили другим (см. core/robot.ts).
 */
import { restoreRobotPreset } from '../core/robot'

export default async function setup(): Promise<void> {
  await restoreRobotPreset()
}
