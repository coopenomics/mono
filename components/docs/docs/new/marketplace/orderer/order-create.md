---
tags:
  - Пайщик
---

# Оформление заказа

Когда пайщик нашёл нужное Предложение в [каталоге][catalog], он переходит к оформлению Заказа.

![Диалог оформления заказа поверх каталога](/assets/new/marketplace/orderer/order-create/01-order-create-dialog.png)

Оформление работает прямо из каталога: клик «Заказать» на карточке APPROVED Предложения открывает диалог формы — отдельная страница для оформления не нужна.

## Что нужно ввести

В диалоге два поля:

- **Количество** — целое число в единицах поставки (`шт`, `кг`, `л`, `упак` — берётся из Предложения). Для Предложений с ограниченным остатком сверху срабатывает граница «Доступно: N» — больше выбрать нельзя; для безлимитных — без верхней границы. Минимум — 1.
- **ПВЗ доставки** — кооперативный участок, куда пайщик хочет получить Заказ. В список попадают все активные ПВЗ кооператива (`MarketplaceKUDetails` со `status='ACTIVE'`). Если в кооперативе один ПВЗ — он выбран по умолчанию.

![Форма с количеством 2 — итоговая сумма обновляется немедленно](/assets/new/marketplace/orderer/order-create/02-order-create-filled.png)

В нижней части диалога — расчёт суммы:

- Цена за единицу (из Предложения).
- Итого = `цена × количество`. Пересчитывается на каждое изменение количества.

Кнопка **«Подтвердить заказ»** становится активной, когда оба поля валидны.

## Что происходит на сабмите

При нажатии «Подтвердить заказ» вызывается мутация `marketplaceCreateOrder`. Backend:

1. Проверяет, что пайщик — член кооператива со статусом, разрешающим оформление заказов (Membership-guard). Если пайщик ещё не подписал ЦПП Стола заказов, придёт ошибка — её показывает поверх диалога.
2. Создаёт Order в Postgres, привязанный к Offer'у и ПВЗ.
3. Отправляет on-chain action `marketplace::createorder` для фиксации операции и блокировки средств.
4. По подтверждению из chain — уменьшает `quantity_available` у Предложения на количество Заказа.

!!!warning "Известный блокер магистрали II (2026-05-22): ЦПП «Стол заказов» не подписана"
    На текущем стенде заказ упирается в on-chain валидацию: пайщик подписал ЦПП Кошелёк (program_id=1, signin onboarding), но **не подписал ЦПП «Стол заказов»** (program_id=2, `draft_id=699` в `soviet::coagreements`, агрегат `w.mkt.member`). Backend проходит весь pipeline (membership-guard → создание order_hash → counter → on-chain `marketplace::createorder` → внутренний `o.mkt.assign`), и контракт валит assertion **«walletop: у пайщика X не подписано соглашение program_id=2 для кошелька w.mkt.member»**. UI отображает читаемое сообщение поверх диалога:

    ![Notify: «walletop: у пайщика ekaterina не подписано соглашение program_id=2 для кошелька w.mkt.member»](/assets/new/marketplace/orderer/order-create/03-order-create-no-agreement.png)

    **Корневая причина — отсутствует продукт-разработка двух частей** core registration-flow:

    1. **Factory adapter `1100.MarketplaceOfferTemplate.ts`** в `components/factory/src/Actions/` — без него `documentFactory.render(registry_id=1100, …)` отвечает «Фабрика для документа #1100 не найдена». Шаблоны 1100/1101 описаны в `cooptypes/cooperative/registry`, но `factory/src/Actions/` сейчас содержит только marketplace-документы поставщика (1102+), а потребительская оферта (1100/1101) не имплементирована.
    2. **L3 mutation `marketplaceSignOnboardingOffer`** в `components/controller/src/extensions/marketplace/application/resolvers/` — обозначена как фоллоуап Эпика 1 (см. `marketplace/application/onboarding/README.md`, секция «Что добавит фоллоуап»). Сейчас страница `onboarding/member-pick-cpp` информационная: показывает gate и редиректит в core Registrator-мастер, но мастер не собирает шаг подписи Marketplace, потому что factory не отвечает на 1100.

    До разблокирования магистраль II останавливается на `o.mkt.assign` для всех тестовых пайщиков, созданных через `registrator::adduser` напрямую (минуя core signup): они уже в `participants_tbl` со status=accepted и с непустым L3 Main Wallet, но без записи в `wallet::users.programs[]` с program_id=2.

    !!!note "Решённые подблокеры (2026-05-22)"
        - **cycle_type mapping**: backend хранил `cycle_type='time_based'`, а контракт ожидает `eosio::name` `timebased` (без подчёркивания — грамматика `eosio::name`). Фикс — `toChainCycleType()` helper в `marketplace-offer.types.ts` + конвертация на boundary `chainPort.createOrder` в `marketplace-order-create.service.ts:160`. Маппинг: `time_based`→`timebased`, `volume_based`→`volumebased`, `open_subscription`→`opensubscr`, `individual`→`individual`.
        - **L3-кошелёк Main Wallet**: тестовые пайщики не имели стартового баланса для проверки «есть ли средства». Скрипт `components/boot/src/scripts/marketplace-deposit-fund.ts` через `wallet::createdeposit + gateway::completeincome` от лица coopname разово пополняет Main Wallet (по умолчанию ekaterina/ivanpetrov/petrova/sidorov по 10000 RUB).

## Что дальше (после фикса)

- Order попадает в ленту [«Мои заказы»][orders] в статусе CREATED.
- Поставщик увидит Заказ в столе [Входящих заказов][incoming] — может акцептовать или отказать.
- При наборе минимального объёма или закрытии цикла Заказ автоматически попадает в [Сводный заказ][consolidated] и уходит поставщику в работу.
- До приёма Заказа поставщиком пайщик может отменить его из ленты «Мои заказы». После приёма — только через [возврат][return].

[catalog]: ./catalog.md
[orders]: ./orders.md
[incoming]: ../offerer/incoming-orders.md
[consolidated]: ./consolidated.md
[return]: ./return-claim.md
