/**
 * @brief Callback от gateway — кассир не смог перечислить налог в бюджет
 * (решение владельца 2026-08-13).
 *
 * В отличие от материальной помощи, отказ здесь осмыслен и разрешён: платёж в
 * бюджет — техническое действие бухгалтерии, а не исполнение решения совета.
 * Не сошлись реквизиты, ошиблись суммой, платёж отклонил банк — заявка
 * закрывается, обязательство остаётся на счёте 68 в полном объёме, и
 * бухгалтер создаёт новую заявку с исправленными данными.
 *
 * Списание не применяется: пока платёж не прошёл, долг перед бюджетом не
 * погашен.
 *
 * Guards:
 *  - require_auth(_gateway) — callback легитимен только от gateway-контракта;
 *  - заявка найдена по outcome_hash.
 *
 * @ingroup public_soviet_actions
 */
[[eosio::action]] void soviet::taxdecline(eosio::name coopname,
                                           eosio::checksum256 outcome_hash,
                                           std::string reason) {
  require_auth(_gateway);

  soviet_taxes_index taxes(_soviet, coopname.value);
  auto byhash = taxes.get_index<"byhash"_n>();
  auto it = byhash.find(outcome_hash);
  eosio::check(it != byhash.end(),
               "Заявка на перечисление налога не найдена по outcome_hash из callback'а gateway");

  byhash.erase(it);
}
