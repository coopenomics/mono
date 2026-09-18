/* eslint-disable no-console */
/**
 * Ручная проба действия draft::approve на локальной цепи (A3D-1).
 * Запуск: pnpm --filter @coopenomics/boot exec esno src/tests/adjust/probe-draft-approve.ts
 */
import Blockchain from '../../blockchain'
import config from '../../configs'
import { generateRandomSHA256 } from '../../utils/randomHash'

const COOP = 'voskhod'
const REGISTRY_ID = 3

const blockchain = new Blockchain(config.network, config.private_keys)

async function approve(data: Record<string, unknown>) {
  return blockchain.api.transact(
    {
      actions: [{
        account: 'draft',
        name: 'approve',
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

async function expectFail(label: string, data: Record<string, unknown>, fragment: string) {
  try {
    await approve(data)
    console.log(`FAIL ${label}: транзакция прошла, ожидался отказ`)
    process.exitCode = 1
  }
  catch (e: any) {
    const msg = String(e?.message ?? e)
    console.log(`${msg.includes(fragment) ? 'ok  ' : 'FAIL'} ${label}: ${msg.split('\n')[0].slice(0, 160)}`)
    if (!msg.includes(fragment))
      process.exitCode = 1
  }
}

async function main() {
  await blockchain.update_pass_instance()
  const [draft] = await blockchain.getTableRows('draft', 'draft', 'drafts', 1, String(REGISTRY_ID), String(REGISTRY_ID))
  const version = Number(draft.version)
  console.log(`шаблон ${REGISTRY_ID}: текущая редакция ${version}`)

  const base = {
    coopname: COOP,
    username: COOP,
    registry_id: REGISTRY_ID,
    version,
    decision_id: 777,
    approved_at: '2026-09-16T00:00:00',
    text_hash: generateRandomSHA256(),
  }

  await approve(base)
  let [row] = await blockchain.getTableRows('draft', COOP, 'approvals', 1, String(REGISTRY_ID), String(REGISTRY_ID))
  console.log(`${row && Number(row.version) === version && Number(row.decision_id) === 777 ? 'ok  ' : 'FAIL'} утверждение текущей редакции:`, row)

  await approve({ ...base, decision_id: 778, text_hash: generateRandomSHA256() });
  [row] = await blockchain.getTableRows('draft', COOP, 'approvals', 1, String(REGISTRY_ID), String(REGISTRY_ID))
  console.log(`${row && Number(row.decision_id) === 778 ? 'ok  ' : 'FAIL'} повторное утверждение обновляет строку: decision_id=${row?.decision_id}`)

  await expectFail('неверная редакция', { ...base, version: version + 1 }, 'не совпадает с текущей редакцией')
  await expectFail('несуществующий шаблон', { ...base, registry_id: 999_999 }, 'Шаблон документа не найден')
  // Номер решения 0 — перенос утверждения из прежних настроек без номера протокола.
  await approve({ ...base, decision_id: 0, text_hash: generateRandomSHA256() });
  [row] = await blockchain.getTableRows('draft', COOP, 'approvals', 1, String(REGISTRY_ID), String(REGISTRY_ID))
  console.log(`${row && Number(row.decision_id) === 0 ? 'ok  ' : 'FAIL'} утверждение без номера решения (перенос) принято`)
  await approve({ ...base, decision_id: 778, text_hash: generateRandomSHA256() });
  await expectFail('область draft', { ...base, coopname: 'draft', username: 'draft' }, 'области кооператива')

  const all = await blockchain.getTableRows('draft', COOP, 'approvals', 100)
  console.log(`строк утверждений у ${COOP}: ${all.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
