/* eslint-disable no-console */
/**
 * Ручная проба A3D-6: текст утверждённой редакции против текущей в сети.
 *
 * Команды (аргумент):
 *   bump-marker  — поднять редакцию шаблона 3 и дописать в текст маркер новой редакции;
 *   approve      — утвердить текущую редакцию шаблона 3 от кооператива;
 *   retouch      — переписать текущий текст без изменений (новая дельта для узла);
 *   restore      — вернуть исходный текст шаблона 3 (без смены редакции).
 *
 * Исходный текст сохраняется в файл рядом при первом bump-marker.
 * Запуск: pnpm --filter @coopenomics/boot exec esno src/tests/adjust/probe-edition-text.ts <команда>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import Blockchain from '../../blockchain'
import config from '../../configs'
import { generateRandomSHA256 } from '../../utils/randomHash'

const COOP = 'voskhod'
const REGISTRY_ID = 3
const MARKER = '<!-- НОВАЯ РЕДАКЦИЯ: ПРОБА ФАБРИКИ УТВЕРЖДЕНИЙ -->'
const BACKUP = '/home/admin/.claude/jobs/790654b0/tmp/draft3-original.json'

const blockchain = new Blockchain(config.network, config.private_keys)

async function draftRow() {
  const [row] = await blockchain.getTableRows('draft', 'draft', 'drafts', 1, String(REGISTRY_ID), String(REGISTRY_ID))
  return row
}

async function transact(account: string, name: string, actor: string, data: Record<string, unknown>) {
  const result = await blockchain.api.transact(
    { actions: [{ account, name, authorization: [{ actor, permission: 'active' }], data }] },
    { blocksBehind: 3, expireSeconds: 30 },
  )
  return result.processed?.block_num
}

async function main() {
  await blockchain.update_pass_instance()
  const cmd = process.argv[2]
  const row = await draftRow()
  console.log(`шаблон ${REGISTRY_ID}: редакция ${row.version}, длина текста ${String(row.context).length}`)

  if (cmd === 'bump-marker') {
    if (!existsSync(BACKUP))
      writeFileSync(BACKUP, JSON.stringify({ title: row.title, description: row.description, context: row.context, model: row.model }))
    const b1 = await transact('draft', 'upversion', 'eosio', { scope: 'draft', username: 'eosio', registry_id: REGISTRY_ID })
    const b2 = await transact('draft', 'editdraft', 'eosio', {
      scope: 'draft', username: 'eosio', registry_id: REGISTRY_ID,
      title: row.title, description: row.description, context: `${MARKER}\n${row.context}`, model: row.model,
    })
    const after = await draftRow()
    console.log(`upversion в блоке ${b1}, editdraft с маркером в блоке ${b2}; редакция теперь ${after.version}`)
  }
  else if (cmd === 'approve') {
    const b = await transact('draft', 'approve', COOP, {
      coopname: COOP, username: COOP, registry_id: REGISTRY_ID, version: Number(row.version), decision_id: 790,
      approved_at: new Date().toISOString().slice(0, 19), text_hash: generateRandomSHA256(),
    })
    console.log(`утверждена редакция ${row.version} в блоке ${b}`)
  }
  else if (cmd === 'retouch') {
    // Повторная запись того же текста: даёт новую дельту, если узел пропустил предыдущую.
    const b = await transact('draft', 'editdraft', 'eosio', {
      scope: 'draft', username: 'eosio', registry_id: REGISTRY_ID,
      title: row.title, description: row.description, context: row.context, model: row.model,
    })
    console.log(`текст переписан без изменений в блоке ${b}`)
  }
  else if (cmd === 'restore') {
    const original = JSON.parse(readFileSync(BACKUP, 'utf8'))
    const b = await transact('draft', 'editdraft', 'eosio', { scope: 'draft', username: 'eosio', registry_id: REGISTRY_ID, ...original })
    console.log(`исходный текст возвращён в блоке ${b}`)
  }
  else {
    console.log('команда: bump-marker | approve | retouch | restore')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
