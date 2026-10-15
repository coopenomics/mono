#pragma once

#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <type_traits>
#include <utility>

/**
 * @brief Плательщик за оперативную память строки таблицы.
 *
 * Оперативную память цепи оплачивает тот аккаунт, чьё имя передано в `emplace`
 * или `modify`. Плательщик меняется при каждом изменении строки и остаётся тем,
 * чьим именем её изменили последней. Пока имя передавалось в каждом месте
 * вручную, одна и та же сущность оказывалась то на кооперативе, то на
 * контракте, то на человеке: в `registrator.accounts` 43 % строк оплачивали
 * кооперативы, за строки советов платило физическое лицо (C28-78, 20.09.2026).
 *
 * Правило одно. Кооператив оплачивает свой бизнес-процесс — документы и их
 * проведение: заявления, решения, акты, заказы, возвраты, взносы, собрания,
 * проекты в работе. Всё остальное — счётчики, настройки, реестры, советы,
 * кошельки, соглашения, аккаунты, договоры участия — оплачивает контракт.
 *
 * Класс объявляется один раз у структуры строки макросом `RAM_PAYER_CLASS`,
 * а каждый `emplace` и `modify` берёт плательщика только через `RamPayer::of`.
 * Первичного определения у `class_of` нет намеренно: таблица без объявленного
 * класса не соберётся, так что забыть правило для новой таблицы нельзя.
 * Сообщения `static_assert` написаны латиницей: компилятор печатает кириллицу
 * восьмеричными кодами, и разработчик не прочёл бы, что сломалось.
 *
 * Строка, записанная до этого правила, переходит к правильному плательщику
 * сама при следующем `modify` — отдельная миграция не нужна.
 *
 * Кооператив может оплатить строку, только если подписал действие: цепь
 * списывает память лишь с того, кто авторизовал запись. Часть действий
 * приходит служебным вызовом — колбэком по решению совета, исполнением
 * другого контракта, — и кооператив их не подписывает. В таком вызове за
 * бизнес-процесс кооператива платит контракт. Жёсткое «платит кооператив»
 * роняло бы эти транзакции отказом цепи.
 */
namespace RamPayer {

  enum class Class : uint8_t {
    /** Бизнес-процесс кооператива: платит кооператив. */
    cooperative,
    /** Служебное хранение: платит контракт — владелец таблицы. */
    contract,
    /**
     * Общее для всей сети: платит системный аккаунт. Так хранится реестр
     * шаблонов документов — он один на все кооперативы и ни одному из них
     * не принадлежит. Если система действие не подписала, платит контракт.
     */
    system,
  };

  /** Класс плательщика строки. Объявляется макросом `RAM_PAYER_CLASS`. */
  template <typename Row>
  struct class_of;

  /**
   * Тип строки таблицы. Выводится разыменованием итератора, поэтому работает
   * и для самой таблицы, и для её вторичного индекса — `modify` бывает у обоих.
   */
  template <typename Table>
  using row_t = std::decay_t<decltype(*std::declval<const Table &>().cbegin())>;

  /** Кооператив, если он подписал действие; иначе контракт — владелец таблицы. */
  template <typename Table>
  inline eosio::name cooperative_or_contract(const Table &table, eosio::name coopname) {
    return eosio::has_auth(coopname) ? coopname : table.get_code();
  }

  /**
   * Плательщик за строку таблицы.
   * @param table таблица, в которую пишется строка; контракт-плательщик — её владелец
   * @param coopname кооператив, чей бизнес-процесс создаёт запись
   */
  template <typename Table>
  inline eosio::name of(const Table &table, eosio::name coopname) {
    constexpr Class cls = class_of<row_t<Table>>::value;

    if constexpr (cls == Class::contract) {
      return table.get_code();
    } else if constexpr (cls == Class::system) {
      // Шаблон в области кооператива заводит сам кооператив, без подписи
      // системы, — тогда платит контракт реестра шаблонов.
      const eosio::name system_account("eosio");
      return eosio::has_auth(system_account) ? system_account : table.get_code();
    } else {
      return cooperative_or_contract(table, coopname);
    }
  }

  /**
   * Плательщик за строку служебной таблицы, где кооператив не участвует
   * (реестры, счётчики, каталог приложений). Для таблиц бизнес-процесса
   * эта форма запрещена — там нужен кооператив.
   */
  template <typename Table>
  inline eosio::name of(const Table &table) {
    static_assert(class_of<row_t<Table>>::value != Class::cooperative,
                  "RamPayer: cooperative table needs coopname, call RamPayer::of(table, coopname)");
    return of(table, eosio::name{});
  }

} // namespace RamPayer

/**
 * Объявить класс плательщика для строки таблицы.
 * Ставится в глобальной области видимости, после определения структуры.
 * @param ROW полное имя структуры строки (с пространством имён)
 * @param CLASS cooperative | contract | system
 */
#define RAM_PAYER_CLASS(ROW, CLASS)                                                                  \
  template <>                                                                                        \
  struct RamPayer::class_of<ROW> {                                                                   \
    static constexpr RamPayer::Class value = RamPayer::Class::CLASS;                                 \
  }
