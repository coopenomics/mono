#!/usr/bin/env node
// Засев Стола заказов для внешнего слоя тестов (C28-82) — без браузера.
//
// Наборы Стола заказов в components/boot/src/tests читают участников из
// components/docs-harness/state/participants/*.json и ждут на стенде участки,
// поставщика с витриной и настройки склада. Всё это готовят те же шаги, что и
// визуальная сюита docs-harness, но сами шаги визуальными не являются:
//   1) ensureFixture — пайщик заводится boot-скриптом add-plain-participant;
//   2) seed-marketplace — фазы через цепь и API контроллера.
// Здесь вызываются ровно эти помощники docs-harness, без своей копии логики.
// Визуальные сценарии сюда не входят — для них будет свой раннер.

import { KNOWN_FIXTURES, ensureFixture, runSeedPhase } from '../../components/docs-harness/lib/fixtures.mjs'

const log = (m) => console.log(`  ${m}`)

console.log('▸ Пайщики-фикстуры docs-harness')
for (const name of Object.keys(KNOWN_FIXTURES)) {
  const how = ensureFixture(name, { log })
  log(`${name}: ${how === 'created' ? 'создан' : 'уже есть'}`)
}

console.log('▸ Фазы засева Стола заказов')
runSeedPhase('all', { log })
console.log('  ✅ засев завершён')
