#include <eosio.system/eosio.system.hpp>
#include <algorithm>

namespace eosiosystem {

  /**
   * @brief Настройка выдачи памяти контрактам платформы.
   * @param config порог, объём выдачи, интервал проверки и список контрактов
   * @ingroup public_actions
   * @ingroup public_system_actions
   * @note Авторизация требуется от аккаунта: @p eosio
   */
  void system_contract::setramgrant(const ram_grant_config& config) {
    require_auth(get_self());

    check(config.threshold_percent > 0 && config.threshold_percent <= 100, "Порог должен быть от 1 до 100 %");
    check(config.grant_bytes > 0, "Объём выдачи должен быть положительным");
    check(config.check_interval_sec > 0, "Интервал проверки должен быть положительным");

    ram_grant_config_singleton cfg(get_self(), get_self().value);
    cfg.set(config, get_self());
  }

  /**
   * @brief Заявка контракта платформы на проверку его памяти.
   *
   * Подаётся контрактом из конструктора `coop_contract`, когда подошло время
   * следующей проверки. Проверяет квоту контракта и при нехватке выдаёт память
   * бессрочно из свободного пула сети — той же схемой, что `powerup` с
   * `transfer = true`, только без оплаты: сеть содержит память своих
   * контрактов сама (C28-78).
   *
   * Заявка подаётся в транзакции пайщика и не имеет права её уронить. Поэтому
   * ни одна ветка здесь не завершается отказом: срок не подошёл, нет настройки,
   * контракт не в списке, квота в порядке, пул пуст — заявка ничего не выдаёт.
   *
   * @param contract контракт, подавший заявку
   * @ingroup public_actions
   * @ingroup public_system_actions
   * @note Авторизация требуется от аккаунта: @p contract
   */
  void system_contract::ramreq(const name& contract) {
    require_auth(contract);

    ram_grant_config_singleton cfg_sing(get_self(), get_self().value);
    const ram_grant_config cfg = cfg_sing.exists() ? cfg_sing.get() : ram_grant_config{};
    const time_point_sec now = eosio::current_time_point();

    // Срок сверяет и конструктор контракта, но полагаться только на него нельзя:
    // контракт с дефектом подавал бы заявку на каждом действии и получал память
    // сверх срока. До срока заявка ничего не меняет.
    ram_watch_table watch(get_self(), get_self().value);
    auto itr = watch.find(contract.value);
    if (itr != watch.end() && itr->next_check > now)
      return;

    int64_t granted = 0;
    const bool allowed = std::find(cfg.contracts.begin(), cfg.contracts.end(), contract) != cfg.contracts.end();

    if (allowed) {
      int64_t quota = 0, net = 0, cpu = 0, used = 0;
      get_resource_limits(contract, quota, net, cpu);
      get_account_ram_usage(contract, used);

      // Квота меньше нуля — память контракта не ограничена, выдавать нечего.
      const bool needs_ram = quota >= 0 && used * 100 >= quota * static_cast<int64_t>(cfg.threshold_percent);

      powerup_state_singleton state_sing(get_self(), 0);
      if (needs_ram && state_sing.exists()) {
        auto state = state_sing.get();

        if (state.ram.utilization + cfg.grant_bytes <= state.ram.weight) {
          state.ram.utilization += cfg.grant_bytes;
          state_sing.set(state, get_self());

          // Сначала гасится долг по памяти, как в `powerup`: он возникает, когда
          // истёкшая аренда оставила квоту ниже занятого.
          const int64_t after_debt = update_ram_debt_table(get_self(), contract, cfg.grant_bytes);
          if (after_debt > 0) {
            const auto core_symbol = get_core_symbol();
            adjust_resources(get_self(), _power_account, core_symbol, 0, 0, -after_debt, true);
            adjust_resources(get_self(), contract, core_symbol, 0, 0, after_debt, true);
          }
          granted = cfg.grant_bytes;
        }
      }
    }

    const time_point_sec next_check = now + cfg.check_interval_sec;
    if (itr == watch.end()) {
      watch.emplace(get_self(), [&](auto& w) {
        w.contract = contract;
        w.next_check = next_check;
        w.granted_bytes = granted;
      });
    } else {
      watch.modify(itr, get_self(), [&](auto& w) {
        w.next_check = next_check;
        w.granted_bytes += granted;
      });
    }
  }

} // namespace eosiosystem
