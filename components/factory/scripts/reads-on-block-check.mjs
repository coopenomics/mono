#!/usr/bin/env node
/**
 * Правило «каждое чтение — на блок» (решение владельца, 28.10.2026).
 *
 * Документ пересобирается по своим метаданным и обязан выйти тем же, каким
 * был: реквизиты кооператива, переменные, данные пайщика и udata читаются в
 * состоянии на блок документа. Чтение без границы блока берёт текущее
 * состояние, и старый документ после смены реквизитов пересобрался бы иначе.
 * Четыре сборщика (994, 996, 998, 1000) так и читали до шага 3.
 *
 * Скрипт сверяет объявления сборщиков: вызов фасада чтения с одним
 * аргументом (без `data.block_num`) или `getUdata` без ключа `block_num` —
 * ошибка со списком мест.
 *
 * Запуск: node scripts/reads-on-block-check.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'src', 'Actions')

/** Чтения фасада, у которых граница блока — последний аргумент. */
const SINGLE_ARG = /\bf\.get(Vars|Cooperative|User|Organization|BankAccount|Project)\(\s*([^,()]+?)\s*\)/g
/** Чтение udata объявляется объектом; ключ block_num обязателен. */
const UDATA = /\bf\.getUdata\(\{([^}]*)\}\)/g

const problems = []
for (const name of readdirSync(dir).filter(n => /^\d+\.[A-Za-z]+\.ts$/.test(n))) {
  const text = readFileSync(join(dir, name), 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(SINGLE_ARG))
      problems.push(`${name}:${i + 1}: ${m[0]} — нет границы блока`)
    for (const m of line.matchAll(UDATA)) {
      if (!m[1].includes('block_num'))
        problems.push(`${name}:${i + 1}: getUdata без block_num`)
    }
  })
}

if (problems.length > 0) {
  console.log('Чтения без границы блока:')
  for (const p of problems)
    console.log(`  ${p}`)
  process.exit(1)
}
console.log('Все чтения сборщиков идут на блок')
