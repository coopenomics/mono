/**
 * @brief Списание уценки по заказу из остатка кооператива (requirement 76,
 * вопрос 4, p.mkt.supply).
 *
 * Имущество остатка оприходовано на счёт 10 по цене прибытия, а выдано
 * пайщику могло быть с уценкой. `signiss2` (o.mkt.consum) закрывает Кт 10
 * только на фактическую сумму выдачи — без этого действия разница зависала
 * бы на складе, которого физически уже нет. Здесь разница выбывает в прочие
 * расходы:
 *
 *  - `o.mkt.loss` (NONE, Дт 91 / Кт 10) — кошельки не двигаются, чисто
 *    бухгалтерская проводка на сумму уценки.
 *
 * Вместе consum + loss дают выбытие по полной стоимости прибытия. Накопленный
 * расход на счёте 91 погашается ПОЗЖЕ отдельным процессом (Дт 86 / Кт 91) по
 * образцу списания скоропорта через решение совета — этот шаг зафиксирован и
 * пока не реализован.
 *
 * Вызывает backend сразу после финализации выдачи: сумму уценки он считает
 * точно по выданным складским позициям (цены прибытия у позиций одного заказа
 * могут отличаться — FIFO-резерв), контракту эта аналитика недоступна.
 *
 * Guards:
 *  - заказ существует и сделан из остатка кооператива (offerer == coopname);
 *  - выдача завершена (status == received) — основание: двухподписный акт;
 *  - amount > 0 в валюте кооператива;
 *  - идемпотентность: уценка по заказу ещё не списывалась (markdown_cost == 0).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::markdown(eosio::name coopname,
                            checksum256 order_hash,
                            eosio::asset amount) {
  require_auth(coopname);

  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма уценки должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме уценки");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.offerer == coopname,
               "Уценка списывается только по заказу из остатка кооператива");
  eosio::check(o.status == OrderStatus::RECEIVED,
               "Уценка списывается после завершения выдачи по акту");
  eosio::check(o.markdown_cost.amount == 0,
               "Уценка по этому заказу уже списана");
  // Уценка не может превышать фактическую сумму выдачи: цена публикации
  // ограничена сверху ценой прибытия (только уценка, без наценки).
  eosio::check(amount <= o.fact_cost,
               "Сумма уценки превышает фактическую сумму выдачи");

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::MARKDOWN_LOSS,
                 processes::marketplace::SUPPLY,
                 amount, o.orderer, o.hash,
                 Marketplace::Memo::get_markdown_loss_memo(o.id));

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.markdown_cost = amount;
  });
}
