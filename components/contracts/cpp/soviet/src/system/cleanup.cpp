/**
 * @brief Очистка отработавших записей совета (lib/core/cleanup.hpp).
 *
 * Правила, по кооперативам:
 * - `agreements` — прежняя таблица соглашений. Строка удаляется, когда в
 *   `agreements3` лежит соглашение с тем же id и тем же пайщиком: подписи
 *   читаются только оттуда, прежнюю таблицу не читает ни действие, ни контроллер.
 * - `joincoops` — заявка на вступление нужна только проверке `validate` решения
 *   типа joincoop с тем же batch_id. Нет такого решения — строку никто не прочитает.
 * - `autosigner` — отметка автоподписи решения. Решение удалено (исполнено,
 *   отклонено или истекло) — отметку никто не прочитает.
 * - `changes` — таблица обмена прежней версии Стола заказов, код, который её
 *   писал и читал, в контракт не собирается.
 *
 * Истёкшие делегирования роботу (`automator`) не трогаем: председатель может
 * продлить делегирование, и строка несёт его настройки.
 *
 * @note Авторизация требуется от аккаунта: @p soviet
 */
void soviet::cleanup() {
  require_auth(_soviet);
  Cleanup::budget budget;

  for (const auto &coopname : Core::Registrator::get_cooperative_names()) {
    if (budget.exhausted()) break;

    agreements_index legacy_agreements(_soviet, coopname.value);
    agreements2_index agreements(_soviet, coopname.value);
    Cleanup::erase_where(legacy_agreements, budget, [&](const auto &legacy) {
      auto current = agreements.find(legacy.id);
      return current != agreements.end() && current->username == legacy.username;
    });

    decisions_index decisions(_soviet, coopname.value);

    joincoops_index joincoops(_soviet, coopname.value);
    Cleanup::erase_where(joincoops, budget, [&](const auto &request) {
      for (const auto &decision : decisions) {
        if (decision.type == "joincoop"_n && decision.batch_id == request.id) return false;
      }
      return true;
    });

    autosigner_index autosigner(_soviet, coopname.value);
    Cleanup::erase_where(autosigner, budget, [&](const auto &mark) {
      return decisions.find(mark.decision_id) == decisions.end();
    });

    changes_index changes(_soviet, coopname.value);
    Cleanup::erase_all(changes, budget);
  }

  Cleanup::report(_soviet, budget);
}
