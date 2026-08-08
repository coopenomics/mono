---
title: Сводный стол КУ: приёмки, выдачи, возвраты
generated_by: docs-harness
scenario: marketplace/branch-chairman/branch-orders
---

# Сводный стол КУ: приёмки, выдачи, возвраты

## Шаг 1. Сводный стол КУ до ввода braname: подсказка «Введите ID вашего КУ» + поле ввода. Auto-detect через marketplace_whoami появится на следующем шаге Story 6.x+1 — председатель КУ привязан к одному branch через trustee.

![Сводный стол КУ до ввода braname: подсказка «Введите ID вашего КУ» + поле ввода. Auto-detect через marketplace_whoami появится на следующем шаге Story 6.x+1 — председатель КУ привязан к одному branch через trustee.](/assets/new/marketplace/branch-chairman/branch-orders/01-empty-input.png)

<!-- TODO: описать шаг, url=http://127.0.0.1:2999/#/voskhod/market-pvz/branch-orders -->

## Шаг 2. После ввода braname КУ Красногорск (krg) — карта с 3 табами и счётчиками: Приёмки (Эпик 5), Выдачи (Эпик 6), Возвраты (Эпик 7). Polling 20s — обновляет все 3 ленты параллельно через Promise.all.

![После ввода braname КУ Красногорск (krg) — карта с 3 табами и счётчиками: Приёмки (Эпик 5), Выдачи (Эпик 6), Возвраты (Эпик 7). Polling 20s — обновляет все 3 ленты параллельно через Promise.all.](/assets/new/marketplace/branch-chairman/branch-orders/02-loaded-tabs.png)

<!-- TODO: описать шаг, url=http://127.0.0.1:2999/#/voskhod/market-pvz/branch-orders -->
