#pragma once

#include <eosio/eosio.hpp>
#include <eosio/../../capi/eosio/db.h> // C API узла; тот же путь, что у CDT в instant_finality.hpp
#include <limits>
#include <map>
#include <type_traits>

/**
 * @brief Очистка отработавших записей — общее для действия `cleanup` всех контрактов.
 *
 * В памяти цепи живёт только рабочее состояние. Процессы удаляют свою запись на
 * терминальном шаге сами; `cleanup` подметает то, что осталось от прежних версий
 * контрактов и от путей, где удаление забыли: строки отработавшего процесса,
 * сироты удалённого родителя, таблицы, которые код больше не читает.
 *
 * Правило очистки — таблица, условие и причина. Условие обязано означать, что
 * строку не прочитает ни одно действие, ни контроллер как живую запись; причину
 * пишем комментарием у правила. Очистка удаляет молча: если для завершения
 * записи нужен колбэк другому контракту, это не очистка, такие строки не трогаем.
 *
 * За вызов удаляется не больше `BUDGET` строк, чтобы транзакция уложилась в
 * лимит CPU. Позицию хранить не нужно: удалённое исчезает, следующий вызов
 * продолжает с оставшегося. Плейбук раскатки вызывает `cleanup` на каждом
 * деплое, и вызов, которому нечего чистить, ничего не пишет.
 */
namespace Cleanup {

  static constexpr uint32_t BUDGET = 100; ///< Строк на один вызов `cleanup`

  /**
   * @brief Есть ли в таблице строка с таким первичным ключом — без разбора строки.
   *
   * `find` у multi_index разбирает строку целиком, а строки бывают по десяткам
   * килобайт (шаблоны документов, описания проектов): проверка «родитель есть»
   * через `find` на каждой строке съедает лимит CPU транзакции. Функция узла та
   * же, что зовёт сам `find` первым шагом (C API из <eosio/db.h>); время её
   * вызова учитывается в CPU транзакции, как и любое другое.
   */
  inline bool row_exists(eosio::name code, uint64_t scope, eosio::name table, uint64_t primary_key) {
    return db_find_i64(code.value, scope, table.value, primary_key) >= 0;
  }

  /**
   * @brief Следующее значение вторичного индекса uint64 не меньше `from` — без разбора строк.
   *
   * Возвращает false, когда значений больше нет. Позволяет обойти только
   * различные значения индекса (например, draft_id у переводов), не поднимая
   * каждую строку.
   */
  template <typename Index>
  inline bool next_index_value(eosio::name code, uint64_t scope, uint64_t from, uint64_t &value) {
    uint64_t secondary = from;
    uint64_t primary = 0;
    const int32_t itr = db_idx64_lowerbound(code.value, scope, Index::name(), &secondary, &primary);
    if (itr < 0) return false;
    value = secondary;
    return true;
  }

  /// Остаток строк, которые текущий вызов ещё может удалить.
  struct budget {
    uint32_t left = BUDGET;
    uint32_t erased = 0;

    bool exhausted() const { return left == 0; }
    void take() {
      --left;
      ++erased;
    }
  };

  /**
   * @brief Удаляет строки индекса или таблицы, для которых выполнено условие.
   *
   * Обходит всю таблицу (или индекс), поэтому годится для таблиц с сотнями
   * строк. Для больших таблиц сужайте обход индексом и диапазоном.
   */
  template <typename Index, typename Pred>
  inline void erase_where(Index &index, budget &b, Pred pred) {
    for (auto it = index.begin(); it != index.end() && !b.exhausted();) {
      if (pred(*it)) {
        it = index.erase(it);
        b.take();
      } else {
        ++it;
      }
    }
  }

  /// Удаляет все строки таблицы, которую код больше не читает и не пишет.
  template <typename Table>
  inline void erase_all(Table &table, budget &b) {
    erase_where(table, b, [](const auto &) { return true; });
  }

  /// Итог вызова в консоль транзакции — его видит лог плейбука.
  inline void report(eosio::name contract, const budget &b) {
    eosio::print("cleanup ", contract, ": удалено строк ", b.erased,
                 b.exhausted() ? ", бюджет исчерпан — продолжит следующий вызов" : "");
  }

} // namespace Cleanup
