# Выплата поставщику через контракт gateway

Шпаргалка для агентов: как устроен поток исходящей выплаты поставщику в
процессе `p.mkt.supply` после разделения `signchair` и `payout` (E11 техдолг
598-16, Locked Decision L12).

## Зачем разделили

Прежний `signchair` атомарно выполнял `o.mkt.purch + o.mkt.payout` —
кооператив закрывал обязательство перед поставщиком по счёту 51 ДО
фактического банковского перевода. Формальное расхождение между bookkeeping
и реальной кассой; недопустимо для регуляторного релиза.

L12 требует, чтобы `o.mkt.payout` (Дт 86 / Кт 51) применялся только по факту
реального банковского перевода. Реальный перевод делает кассир через свой
стол в контракте `gateway` — а контракт `gateway` уже умеет дёргать обратно
contract-callback'ом, как только кассир подтвердил/отказал.

## Триплет действий

| Action                    | Кто вызывает           | Что делает                                                      |
|---------------------------|------------------------|-----------------------------------------------------------------|
| `marketplace::payout`     | backend (auth coopname) | inline `gateway::createoutpay` — регистрирует исходящий платёж  |
| `marketplace::payconfirm` | gateway (auth _gateway) | callback от `gateway::outcomplete` — применяет `o.mkt.payout`   |
| `marketplace::paydecline` | gateway (auth _gateway) | callback от `gateway::outdecline` — фиксирует отказ, без ledger |

## Под-граф `order.payout_status`

```
        marketplace::payout                   marketplace::payconfirm
   none ────────────────────────►  pending ────────────────────────►  completed
                                      │
                                      │  marketplace::paydecline
                                      ▼
                                  declined ──┐
                                      ▲       │ marketplace::payout (повтор)
                                      └───────┘
```

- `none` — приёмка завершена, выплата ещё не инициировалась.
- `pending` — gateway хранит запись `outcomes` со статусом pending, ждёт
  действия кассира.
- `completed` — gateway стёр запись (на outcomplete) и callback'ом дёрнул
  `payconfirm`; применён o.mkt.payout, обязательство закрыто.
- `declined` — gateway стёр запись (на outdecline) и callback'ом дёрнул
  `paydecline`; обязательство Кт 86 остаётся открытым, сохраняется
  `payout_decline_reason`. Backend может повторить `payout`.

Статус самого `Order.status` (READY_TO_RECEIVE / RECEIVED) в этом поток
никак не участвует — выплата может идти параллельно шагам выдачи.

## Контрактные детали

- `outcome_hash` для gateway = `order.hash`. Уникальность гарантирована
  индексом `byhash` orders. На decline gateway стирает свою запись, что
  снимает коллизию для повторной инициации.
- `username` для gateway = `order.offerer` — это пайщик-поставщик, который
  получит деньги.
- `quantity` = `order.total_cost`.
- `callback_contract = _marketplace`, `confirm_callback = "payconfirm"_n`,
  `decline_callback = "paydecline"_n`.
- `marketplace` уже в `contracts_whitelist` в `lib/consts.hpp`, поэтому
  inline-вызов `gateway::createoutpay` проходит auth-чек на gateway-стороне.

Гарды:

- `payout`: `order.status ∈ { accepted_to_coop, ready_to_receive, received }`
  и `order.payout_status ∈ { none, declined }`.
- `payconfirm` / `paydecline`: `require_auth(_gateway)` +
  `order.payout_status == pending`.

`payout_decline_reason` очищается при инициации новой попытки (`payout`) и
при успехе (`payconfirm`); заполняется только в `paydecline`.

## Что меняется в backend (controller)

- `MarketplaceCanonicalBlockchainPort.payOut(coopname, order_hash)` —
  единственный action, который backend сам отправляет. Кассир будет вызывать
  его из админки через application service (Story 5.6 ещё не реализована —
  port готов).
- `payconfirm` / `paydecline` backend сам **не отправляет**. Контракт
  gateway вызывает их inline'ом, parser2 разбирает их как обычные
  blockchain_actions, controller подхватывает через delta-stream и обновляет
  `marketplace_outgoing_payment_request.status` (PENDING_CASHIER_ACTION →
  CONFIRMED_BY_CASHIER → LEDGER_RECORDED при `payconfirm`; CASHIER_DECLINED
  при `paydecline`). Это уже зона Story 5.6 — здесь сделан только
  C++/cooptypes/port-foundation.

## Что НЕ делать (anti-patterns)

- Не дёргать `Ledger2::apply(o.mkt.payout, …)` где-либо кроме `payconfirm`.
- Не выставлять `payout_status = completed` ни в одном action кроме
  `payconfirm`.
- Не отправлять `payout` если `payout_status == pending` — это создаст
  дубль `outcomes` в gateway (gateway сам ругнётся, но лучше отсечь раньше).
- Не разрешать backend дёргать `payconfirm` / `paydecline` напрямую —
  только gateway-контракт через inline-action.
- Не вводить отдельный `outcome_hash` поле в `order` — пока он совпадает
  с `order.hash`, дублирование избыточно.

## Источники правды

- `components/contracts/cpp/marketplace/src/p.mkt.supply/payout.cpp` /
  `payconfirm.cpp` / `paydecline.cpp` — реализация.
- `components/contracts/cpp/lib/domain/table_marketplace_orders.hpp` —
  `order.payout_status`, `payout_decline_reason`, `OrderPayoutStatus` enum.
- `components/contracts/cpp/marketplace/p.mkt.supply.standard.yaml` —
  states/transitions/operations/scenario (`step 6a` / `6b` + alternative
  «Кассир отклонил банковский перевод»).
- `components/contracts/cpp/lib/core/gateway/gateway.hpp` —
  `Gateway::create_outcome` helper и сигнатура `CREATEOUTPAY_SIGNATURE`.
- `components/contracts/cpp/gateway/src/outpay/outcomplete.cpp` /
  `outdecline.cpp` — где gateway отправляет callback.
