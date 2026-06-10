/**
 * @brief Установка отсечки персонального распределения членского взноса
 * кооперативного участка (requirement b6 «Экономика КУ»).
 *
 * Отсечка определяет, какая доля членского взноса при финализации заказа
 * распределяется персонально между председателем и доверенными КУ (по весам
 * реестра branch::weights); всё остальное уходит в общий кошелёк КУ.
 *
 * Проценты — в долях HUNDR_PERCENTS (1000000 = 100%). Отсечка 0 (или
 * отсутствие записи) — весь взнос в общий кошелёк КУ.
 *
 * Guards:
 *  - КУ существует; настройку меняет именно председатель этого КУ (trustee).
 *
 * @note Авторизация требуется от аккаунта: @p coopname (инициирует
 * председатель КУ со стола ПВЗ, подлинность проверяет бэкенд; on-chain
 * дополнительно фиксируется, что указанный инициатор — председатель КУ).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::setsplit(eosio::name coopname, eosio::name initiator,
                            eosio::name braname, uint64_t personal_percent) {
  require_auth(coopname);

  eosio::check(personal_percent <= HUNDR_PERCENTS,
               "Доля персонального распределения не может превышать 100%");

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.trustee == initiator,
               "Отсечку распределения меняет только председатель кооперативного участка");

  branch_splits_index splits(_marketplace, coopname.value);
  auto it = splits.find(braname.value);

  if (it == splits.end()) {
    splits.emplace(coopname, [&](auto& s) {
      s.braname          = braname;
      s.personal_percent = personal_percent;
    });
  } else {
    splits.modify(it, coopname, [&](auto& s) {
      s.personal_percent = personal_percent;
    });
  }
}
