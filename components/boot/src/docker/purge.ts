import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import mongoose from 'mongoose'

/**
 * Очистка MongoDB при перезапуске стенда. При FACTORY_STORAGE=postgres данных
 * фабрики в MongoDB нет, а PostgreSQL пересоздаётся скриптом extra_reboot.sh
 * целиком — чистить нечего.
 */
export async function clearDB(): Promise<void> {
  // eslint-disable-next-line node/prefer-global/process
  if (process.env.FACTORY_STORAGE === 'postgres')
    return
  // eslint-disable-next-line node/prefer-global/process
  await mongoose.connect(process.env.MONGO_URI as string)

  for (const name of ['users', 'sync', 'actions', 'deltas']) {
    try {
      await mongoose.connection.collection(name).deleteMany({})
      console.log(`Все документы удалены из коллекции ${name}`)
    }
    catch (e) {
      console.error('Ошибка при удалении:', e)
    }
  }
}

export async function clearDirectory(dirPath: string): Promise<void> {
  try {
    const files = await fs.readdir(dirPath)
    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stats = await fs.stat(filePath)

      if (stats.isDirectory()) {
        await clearDirectory(filePath)
        await fs.rmdir(filePath)
      }
      else {
        await fs.unlink(filePath)
      }
    }
  }
  catch (err) {
    console.error(`Error clearing directory ${dirPath}:`, err)
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  }
  catch (err) {
    // console.error(`Error deleting file ${filePath}:`, err)
  }
}
