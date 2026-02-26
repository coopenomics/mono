
# Cooplace — Разработчикам

## GraphQL API

Cooplace предоставляет GraphQL API для работы с карточками, категориями и настройками маркетплейса.

### Настройки маркетплейса

Получение текущих настроек:

{{ get_sdk_doc("Queries", "Cooplace", "GetMarketplaceSettings") }} | {{ get_graphql_doc("Query.getMarketplaceSettings") }}

```graphql
query {
  getMarketplaceSettings {
    lead_request_policy    # offers_only | orders_only | both
    publish_access_policy  # all_members | whitelist | council_only
    publish_whitelist
    moderation_required
    cycles_enabled
    max_cycle_days
    external_delivery_enabled
    internal_delivery_enabled
    allowed_category_ids
    min_unit_cost
    max_unit_cost
  }
}
```

Обновление настроек (только chairman):

```graphql
mutation {
  updateMarketplaceSettings(data: {
    lead_request_policy: offers_only
    publish_access_policy: whitelist
    publish_whitelist: ["supplier1", "supplier2"]
    moderation_required: true
    cycles_enabled: true
    max_cycle_days: 14
  }) {
    lead_request_policy
  }
}
```

### Карточки товаров

Создание карточки (черновик):

```graphql
mutation {
  createProductCard(data: {
    type: offer
    title: "Молоко 1л"
    description: "Фермерское молоко"
    unit_cost: "100.0000 RUB"
    units: 200
    delivery_type: internal
    contribution_type: share
    product_lifecycle_secs: 604800
    warranty_period_secs: 259200
    min_units: 100
    cycle_deadline: "2025-02-07T00:00:00Z"
  }) {
    id
    status  # draft
  }
}
```

Отправка на модерацию:

```graphql
mutation {
  submitProductCardForModeration(id: "card-uuid") {
    status  # moderation
  }
}
```

Одобрение (chairman):

```graphql
mutation {
  approveProductCard(id: "card-uuid") {
    status  # published
  }
}
```

Витрина (опубликованные карточки):

```graphql
query {
  getProductCards(type: offer, page: 1, limit: 20) {
    id
    title
    unit_cost
    units
    cycle_collected_units
    cycle_deadline
    cycle_active
  }
}
```

### Поставки (blockchain actions)

После match заказ уходит в блокчейн. Основные мутации:

| Мутация | Описание | Кто вызывает |
|---------|----------|--------------|
| `orderoffer` | Создать заявку orderoffer | Заказчик |
| `accept` | Принять заявку | Поставщик |
| `supply` | Поставить имущество | Поставщик |
| `confirmSupplyOnRequest` | Подтвердить поставку | Председатель КУ |
| `reqReturn` | Запросить возврат | Заказчик |
| `receiveOnRequest` | Передать имущество | Председатель КУ |
| `confirmReceiveOnRequest` | Подтвердить получение | Заказчик |
| `completeRequest` | Завершить поставку | Система |

### Перевозки

```graphql
mutation {
  createShipment(data: {
    hash: "shipment-hash"
    driver_username: "driver1"
    source_braname: "branch1"
    destination_braname: "branch2"
    request_hashes: ["order-hash-1", "order-hash-2"]
    transport_act: { ... }
  }) {
    transaction_id
  }
}
```

| Этап | Мутация | Кто подписывает |
|------|---------|-----------------|
| Загрузка | `createShipment` | КУ отправителя |
| В пути | `signShipmentByDriver` | Водитель |
| Прибыл | `shipmentArrived` | Водитель |
| Приём | `receiveShipment` | КУ получателя |

### Гарантийный возврат

```graphql
mutation {
  disputeOnRequest(data: {
    request_hash: "order-hash"
    document: { ... }  # Претензия с фото/видео
  }) {
    transaction_id
  }
}
```

### Уничтожение / Перепредложение

```graphql
# Уничтожить просроченное имущество
mutation {
  destroyRequest(data: {
    request_hash: "order-hash"
    destruction_act: { ... }
  }) { transaction_id }
}

# Перепредложить по новой цене
mutation {
  reofferRequest(data: {
    request_hash: "order-hash"
    new_hash: "new-hash"
    new_unit_cost: "50.0000 RUB"
    new_meta: "Уценённый товар"
  }) { transaction_id }
}
```

## Смарт-контракт marketplace

Контракт содержит 31 action. Основные:

| Action | Описание |
|--------|----------|
| `orderoffer` | Заказчик создаёт заявку (offer→order) |
| `createorder` | Заказчик публикует заказ (order→offer) |
| `respondoffer` | Поставщик откликается на заказ |
| `accept` | Поставщик принимает orderoffer |
| `authcontrib` | Совет авторизует взнос |
| `supply` / `supplcnf` | Поставка + подтверждение |
| `reqreturn` | Запрос возврата перед получением |
| `authreturn` | Совет авторизует возврат |
| `receive` / `receivecnf` | Получение + подтверждение |
| `complete` | Завершение после гарантии |
| `coopstock` | Имущество из запасов кооператива |
| `acceptstock` | Заказчик принимает coopstock |
| `destroy` | Уничтожение просроченного |
| `reoffer` | Перепредложение по новой цене |
| `dispute` | Гарантийный возврат |

