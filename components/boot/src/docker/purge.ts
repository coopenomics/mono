import { promises as fs } from 'node:fs'
import * as path from 'node:path'

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
