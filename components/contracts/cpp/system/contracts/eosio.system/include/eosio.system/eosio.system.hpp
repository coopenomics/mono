#pragma once

/**
\defgroup public_system Контракт SYSTEM
*/

/**
\defgroup public_system_processes Процессы
\ingroup public_system
*/

/**
\defgroup public_system_actions Действия
\ingroup public_system
*/

/**
\defgroup public_system_tables Таблицы
\ingroup public_system
*/

/**
\defgroup public_system_consts Константы
\ingroup public_system
*/

#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/privileged.hpp>
#include <eosio/producer_schedule.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include <eosio.system/exchange_state.hpp>
#include <eosio.system/native.hpp>

#include <deque>
#include <optional>
#include <string>
#include <type_traits>
#include "../../../../../lib/consts.hpp"


#define CHANNEL_RAM_AND_NAMEBID_FEES_TO_REX 0

namespace eosiosystem {

   using eosio::asset;
   using eosio::binary_extension;
   using eosio::block_timestamp;
   using eosio::check;
   using eosio::const_mem_fun;
   using eosio::datastream;
   using eosio::indexed_by;
   using eosio::name;
   using eosio::same_payer;
   using eosio::symbol;
   using eosio::symbol_code;
   using eosio::time_point;
   using eosio::time_point_sec;
   using eosio::unsigned_int;

   /** @ingroup public_system_consts */
   inline constexpr int64_t powerup_frac = 1'000'000'000'000'000ll;  // 1.0 = 10^15

   template<typename E, typename F>
   static inline auto has_field( F flags, E field )
   -> std::enable_if_t< std::is_integral_v<F> && std::is_unsigned_v<F> &&
                        std::is_enum_v<E> && std::is_same_v< F, std::underlying_type_t<E> >, bool>
   {
      return ( (flags & static_cast<F>(field)) != 0 );
   }

   template<typename E, typename F>
   static inline auto set_field( F flags, E field, bool value = true )
   -> std::enable_if_t< std::is_integral_v<F> && std::is_unsigned_v<F> &&
                        std::is_enum_v<E> && std::is_same_v< F, std::underlying_type_t<E> >, F >
   {
      if( value )
         return ( flags | static_cast<F>(field) );
      else
         return ( flags & ~static_cast<F>(field) );
   }

   /** @ingroup public_system_consts */
   static constexpr uint32_t seconds_per_year      = 52 * 7 * 24 * 3600; ///< Количество секунд в году
   /** @ingroup public_system_consts */
   static constexpr uint32_t seconds_per_day       = 24 * 3600; ///< Количество секунд в дне
   /** @ingroup public_system_consts */
   static constexpr uint32_t seconds_per_hour      = 3600; ///< Количество секунд в часе
   /** @ingroup public_system_consts */
   static constexpr int64_t  useconds_per_year     = int64_t(seconds_per_year) * 1000'000ll; ///< Количество микросекунд в году
   /** @ingroup public_system_consts */
   static constexpr int64_t  useconds_per_day      = int64_t(seconds_per_day) * 1000'000ll; ///< Количество микросекунд в дне
   /** @ingroup public_system_consts */
   static constexpr int64_t  useconds_per_hour     = int64_t(seconds_per_hour) * 1000'000ll; ///< Количество микросекунд в часе
   /** @ingroup public_system_consts */
   static constexpr uint32_t blocks_per_day        = 2 * seconds_per_day; ///< Количество блоков в дне (половина секунды на блок)

   /** @ingroup public_system_consts */
   static constexpr int64_t  min_activated_stake   = 150'000'000'0000; ///< Минимальная активированная ставка
   /** @ingroup public_system_consts */
   static constexpr int64_t  ram_gift_bytes        = 0; ///< Подарочные байты RAM (1400)
   /** @ingroup public_system_consts */
   static constexpr int64_t  min_pervote_daily_pay = 1'0000; ///< Минимальная ежедневная оплата за голос
   /** @ingroup public_system_consts */
   static constexpr uint32_t refund_delay_sec      = 3 * seconds_per_day; ///< Задержка возврата в секундах

   
#ifdef SYSTEM_BLOCKCHAIN_PARAMETERS
   struct blockchain_parameters_v1 : eosio::blockchain_parameters
   {
      eosio::binary_extension<uint32_t> max_action_return_value_size;
      EOSLIB_SERIALIZE_DERIVED( blockchain_parameters_v1, eosio::blockchain_parameters,
                                (max_action_return_value_size) )
   };
   using blockchain_parameters_t = blockchain_parameters_v1;
#else
   using blockchain_parameters_t = eosio::blockchain_parameters;
#endif


  
   /**
   * @brief Таблица ставок на имена хранит информацию о аукционах на премиум имена.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): eosio.system
   * @par Имя таблицы (table): namebids
   */
   struct [[eosio::table, eosio::contract("eosio.system")]] name_bid {
     name            newname; ///< Имя, на которое делается ставка
     name            high_bidder; ///< Аккаунт с наивысшей ставкой
     int64_t         high_bid = 0; ///< Сумма наивысшей ставки (отрицательная означает закрытый аукцион)
     time_point      last_bid_time; ///< Время последней ставки

     uint64_t primary_key()const { return newname.value;                    } ///< Первичный ключ (1)
     uint64_t by_high_bid()const { return static_cast<uint64_t>(-high_bid); } ///< Индекс по наивысшей ставке (2)
   };

   /**
   * @brief Таблица возвратов ставок хранит информацию о возвратах средств от неудачных ставок на имена.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): eosio.system
   * @par Имя таблицы (table): bidrefunds
   */
   struct [[eosio::table, eosio::contract("eosio.system")]] bid_refund {
      name         bidder; ///< Аккаунт, которому принадлежит возврат
      asset        amount; ///< Сумма к возврату

      uint64_t primary_key()const { return bidder.value; } ///< Первичный ключ (1)
   };
   typedef eosio::multi_index< "namebids"_n, name_bid,
                               indexed_by<"highbid"_n, const_mem_fun<name_bid, uint64_t, &name_bid::by_high_bid>  >
                             > name_bid_table;

   typedef eosio::multi_index< "bidrefunds"_n, bid_refund > bid_refund_table;

   /**
   * @brief Глобальное состояние системы хранит основные параметры блокчейна и статистику.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): eosio.system
   * @par Имя таблицы (table): global
   */
   struct [[eosio::table("global"), eosio::contract("eosio.system")]] eosio_global_state : eosio::blockchain_parameters {
      uint64_t free_ram()const { return max_ram_size - total_ram_bytes_reserved; } ///< Возвращает количество свободной RAM

      uint64_t             max_ram_size = 8ll*1024 * 1024 * 1024; ///< Максимальный размер RAM
      uint64_t             total_ram_bytes_reserved = 0; ///< Общее количество зарезервированных байт RAM
      int64_t              total_ram_stake = 0; ///< Общая ставка RAM

      block_timestamp      last_producer_schedule_update; ///< Время последнего обновления расписания продюсеров
      time_point           last_pervote_bucket_fill; ///< Время последнего заполнения корзины за голос
      int64_t              pervote_bucket = 0; ///< Корзина наград за голосование
      int64_t              perblock_bucket = 0; ///< Корзина наград за блок
      uint32_t             total_unpaid_blocks = 0; ///< Общее количество неоплаченных блоков
      int64_t              total_activated_stake = 0; ///< Общая активированная ставка
      time_point           thresh_activated_stake_time; ///< Время достижения порога активированной ставки
      uint16_t             last_producer_schedule_size = 0; ///< Размер последнего расписания продюсеров
      double               total_producer_vote_weight = 0; ///< Сумма всех голосов продюсеров
      uint16_t             new_ram_per_block = 0; ///< Новый RAM за блок
      block_timestamp      last_ram_increase; ///< Время последнего увеличения RAM
      uint8_t              revision = 0; ///< Ревизия для отслеживания обновлений версий

      block_timestamp      last_name_close; ///< Время последнего закрытия имени

      // explicit serialization macro is not necessary, used here only to improve compilation time
      EOSLIB_SERIALIZE_DERIVED( eosio_global_state, eosio::blockchain_parameters,
                                (max_ram_size)(total_ram_bytes_reserved)(total_ram_stake)
                                (last_producer_schedule_update)(last_pervote_bucket_fill)
                                (pervote_bucket)(perblock_bucket)(total_unpaid_blocks)(total_activated_stake)(thresh_activated_stake_time)
                                (last_producer_schedule_size)(total_producer_vote_weight)
                                (new_ram_per_block)(last_ram_increase)(revision)
                                (last_name_close) )
   };


   inline eosio::block_signing_authority convert_to_block_signing_authority( const eosio::public_key& producer_key ) {
      return eosio::block_signing_authority_v0{ .threshold = 1, .keys = {{producer_key, 1}} };
   }

   /**
   * @brief Таблица информации о продюсерах хранит данные о зарегистрированных блок-продюсерах.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): eosio.system
   * @par Имя таблицы (table): producers
   */
   struct [[eosio::table, eosio::contract("eosio.system")]] producer_info {
      name                                                     owner; ///< Владелец аккаунта продюсера
      double                                                   total_votes = 0; ///< Общее количество голосов
      eosio::public_key                                        producer_key; ///< Публичный ключ продюсера
      bool                                                     is_active = true; ///< Активен ли продюсер
      std::string                                              url; ///< URL продюсера
      uint32_t                                                 unpaid_blocks = 0; ///< Количество неоплаченных блоков
      time_point                                               last_result_time; ///< Время последнего результата
      uint16_t                                                 location = 0; ///< Локация продюсера
      eosio::binary_extension<eosio::block_signing_authority>  producer_authority; ///< Авторизация подписи блоков (добавлено в версии 1.9.0)

      uint64_t primary_key()const { return owner.value;                             }
      double   by_votes()const    { return is_active ? -total_votes : total_votes;  }
      bool     active()const      { return is_active;                               }
      void     deactivate()       { producer_key = public_key(); producer_authority.reset(); is_active = false; }

      eosio::block_signing_authority get_producer_authority()const {
         if( producer_authority.has_value() ) {
            bool zero_threshold = std::visit( [](auto&& auth ) -> bool {
               return (auth.threshold == 0);
            }, *producer_authority );
            // zero_threshold could be true despite the validation done in regproducer2 because the v1.9.0 eosio.system
            // contract has a bug which may have modified the producer table such that the producer_authority field
            // contains a default constructed eosio::block_signing_authority (which has a 0 threshold and so is invalid).
            if( !zero_threshold ) return *producer_authority;
         }
         return convert_to_block_signing_authority( producer_key );
      }

      // The unregprod and claimrewards actions modify unrelated fields of the producers table and under the default
      // serialization behavior they would increase the size of the serialized table if the producer_authority field
      // was not already present. This is acceptable (though not necessarily desired) because those two actions require
      // the authority of the producer who pays for the table rows.
      // However, the rmvproducer action and the onblock transaction would also modify the producer table in a similar
      // way and increasing its serialized size is not acceptable in that context.
      // So, a custom serialization is defined to handle the binary_extension producer_authority
      // field in the desired way. (Note: v1.9.0 did not have this custom serialization behavior.)

      template<typename DataStream>
      friend DataStream& operator << ( DataStream& ds, const producer_info& t ) {
         ds << t.owner
            << t.total_votes
            << t.producer_key
            << t.is_active
            << t.url
            << t.unpaid_blocks
            << t.last_result_time
            << t.location;

         if( !t.producer_authority.has_value() ) return ds;

         return ds << t.producer_authority;
      }

      template<typename DataStream>
      friend DataStream& operator >> ( DataStream& ds, producer_info& t ) {
         return ds >> t.owner
                   >> t.total_votes
                   >> t.producer_key
                   >> t.is_active
                   >> t.url
                   >> t.unpaid_blocks
                   >> t.last_result_time
                   >> t.location
                   >> t.producer_authority;
      }
   };

   /**
   * @brief Таблица информации о голосующих хранит данные о голосующих и их голосах.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): eosio.system
   * @par Имя таблицы (table): voters
   */
   struct [[eosio::table, eosio::contract("eosio.system")]] voter_info {
      name                owner;     ///< Голосующий
      name                proxy;     ///< Прокси, установленный голосующим
      std::vector<name>   producers; ///< Продюсеры, одобренные этим голосующим, если прокси не установлен
      int64_t             staked = 0; ///< Количество застейканных токенов

      //  Every time a vote is cast we must first "undo" the last vote weight, before casting the
      //  new vote weight.  Vote weight is calculated as:
      //  stated.amount * 2 ^ ( weeks_since_launch/weeks_per_year)
      double              last_vote_weight = 0; ///< Вес голоса, отданный в последний раз при обновлении голоса

      // Total vote weight delegated to this voter.
      double              proxied_vote_weight= 0; ///< Общий вес голосов, делегированных этому голосующему как прокси
      bool                is_proxy = 0; ///< Является ли голосующий прокси для других

      uint32_t            flags1 = 0; ///< Флаги управления ресурсами
      uint32_t            reserved2 = 0; ///< Зарезервированное поле 2
      eosio::asset        reserved3; ///< Зарезервированное поле 3

      uint64_t primary_key()const { return owner.value; }

      enum class flags1_fields : uint32_t {
         ram_managed = 1,
         net_managed = 2,
         cpu_managed = 4
      };

      // explicit serialization macro is not necessary, used here only to improve compilation time
      EOSLIB_SERIALIZE( voter_info, (owner)(proxy)(producers)(staked)(last_vote_weight)(proxied_vote_weight)(is_proxy)(flags1)(reserved2)(reserved3) )
   };


   typedef eosio::multi_index< "voters"_n, voter_info >  voters_table;

   typedef eosio::multi_index< "producers"_n, producer_info,
                               indexed_by<"prototalvote"_n, const_mem_fun<producer_info, double, &producer_info::by_votes>  >
                             > producers_table;

   typedef eosio::singleton< "global"_n, eosio_global_state >   global_state_singleton;

   /**
   * @brief Таблица ресурсов пользователя хранит информацию о ресурсах, принадлежащих пользователю.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): eosio.system
   * @par Имя таблицы (table): userres
   */
   struct [[eosio::table, eosio::contract("eosio.system")]] user_resources {
      name          owner; ///< Владелец ресурсов
      asset         net_weight; ///< Вес сети
      asset         cpu_weight; ///< Вес CPU
      int64_t       ram_bytes = 0; ///< Количество байт RAM

      bool is_empty()const { return net_weight.amount == 0 && cpu_weight.amount == 0 && ram_bytes == 0; } ///< Проверяет, пусты ли ресурсы
      uint64_t primary_key()const { return owner.value; } ///< Первичный ключ (1)

      // explicit serialization macro is not necessary, used here only to improve compilation time
      EOSLIB_SERIALIZE( user_resources, (owner)(net_weight)(cpu_weight)(ram_bytes) )
   };


   /**
   * @brief Таблица делегированной пропускной способности хранит информацию о делегированных ресурсах между пользователями.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): from
   * @par Имя таблицы (table): delband
   */
   struct [[eosio::table, eosio::contract("eosio.system")]] delegated_bandwidth {
      name          from; ///< Отправитель делегирования
      name          to; ///< Получатель делегирования
      asset         net_weight; ///< Вес сети
      asset         cpu_weight; ///< Вес CPU

      bool is_empty()const { return net_weight.amount == 0 && cpu_weight.amount == 0; } ///< Проверяет, пусто ли делегирование
      uint64_t  primary_key()const { return to.value; } ///< Первичный ключ (1)

      // explicit serialization macro is not necessary, used here only to improve compilation time
      EOSLIB_SERIALIZE( delegated_bandwidth, (from)(to)(net_weight)(cpu_weight) )

   };

   /**
   * @brief Таблица запросов на возврат хранит информацию о запросах на возврат делегированных ресурсов.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): eosio.system
   * @par Имя таблицы (table): refunds
   */
   struct [[eosio::table, eosio::contract("eosio.system")]] refund_request {
      name            owner; ///< Владелец запроса на возврат
      time_point_sec  request_time; ///< Время запроса
      eosio::asset    net_amount; ///< Сумма сети для возврата
      eosio::asset    cpu_amount; ///< Сумма CPU для возврата

      bool is_empty()const { return net_amount.amount == 0 && cpu_amount.amount == 0; } ///< Проверяет, пуст ли запрос на возврат
      uint64_t  primary_key()const { return owner.value; } ///< Первичный ключ (1)

      // explicit serialization macro is not necessary, used here only to improve compilation time
      EOSLIB_SERIALIZE( refund_request, (owner)(request_time)(net_amount)(cpu_amount) )
   };

    /**
    * @brief Таблица записей о долгах по RAM хранит информацию о долгах аккаунтов по RAM.
    * @ingroup public_tables
    * @ingroup public_system_tables

    * @par Область памяти (scope): eosio.system
    * @par Имя таблицы (table): ramdebts
    */
    struct [[eosio::table, eosio::contract("eosio.system")]] ram_debt_record {
        name account; ///< Аккаунт
        int64_t ram_debt; ///< Долг по RAM

        uint64_t primary_key() const { return account.value; } ///< Первичный ключ (1)
    };
   
   typedef eosio::multi_index<"ramdebts"_n, ram_debt_record> ram_debts_table;


   typedef eosio::multi_index< "userres"_n, user_resources >      user_resources_table;
   typedef eosio::multi_index< "delband"_n, delegated_bandwidth > del_bandwidth_table;
   typedef eosio::multi_index< "refunds"_n, refund_request >      refunds_table;
   
   struct powerup_config {
      std::optional<uint32_t> powerup_days;     // `powerup` `days` argument must match this. Do not specify to preserve the
                                                //    existing setting or use the default.
      std::optional<asset>    min_powerup_fee;  // Fees below this amount are rejected. Do not specify to preserve the
                                                //    existing setting (no default exists).

      EOSLIB_SERIALIZE( powerup_config, (powerup_days)(min_powerup_fee) )
   };

   struct powerup_state_resource {
      int64_t        weight                  = 0;                  // resource market weight. calculated; varies over time.
                                                                   //    1 represents the same amount of resources as 1
                                                                   //    satoshi of SYS staked.
      int64_t        utilization             = 0;                  // Instantaneous resource utilization. This is the current
                                                                   //    amount sold. utilization <= weight.
   };

   /**
   * @brief Таблица состояния powerup хранит состояние рынка ресурсов для powerup.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): eosio.system
   * @par Имя таблицы (table): powerstate
   */
   struct [[eosio::table("powerstate"),eosio::contract("eosio.system")]] powerup_state {
      static constexpr uint32_t default_powerup_days = 30; ///< 30-дневный powerup ресурсов
      powerup_state_resource     net               = {}; ///< Состояние рынка NET
      powerup_state_resource     cpu               = {}; ///< Состояние рынка CPU
      powerup_state_resource     ram               = {}; ///< Состояние рынка RAM
      
      uint32_t                   powerup_days      = default_powerup_days; ///< Количество дней powerup
      asset                      min_powerup_fee   = {}; ///< Минимальная комиссия powerup

      uint64_t primary_key()const { return 0; } ///< Первичный ключ (1)
   };

   typedef eosio::singleton<"powerstate"_n, powerup_state> powerup_state_singleton;



  /**
  * @brief Таблица состояния эмиссии хранит информацию о текущем такте эмиссии токенов.
  * @ingroup public_tables
  * @ingroup public_system_tables

  * @par Область памяти (scope): eosio.system
  * @par Имя таблицы (table): emission
  */
  struct [[eosio::table("emission"),eosio::contract("eosio.system")]] emission_state {
      uint64_t                   tact_number           = 1; ///< Номер такта
      uint64_t                   tact_duration     = 86400; ///< Время продолжительности такта
      double                     emission_factor  = double(0.618); ///< Фактор эмиссии
      asset                      current_supply; ///< Объем токенов в системе
      eosio::time_point_sec      tact_open_at; ///< Дата открытия такта
      eosio::time_point_sec      tact_close_at; ///< Дата закрытия такта
      asset                      tact_fees; ///< Накопленные комиссии такта
      asset                      back_from_producers; ///< Вернулось в фонд от делегатских комиссий
      asset                      tact_emission; ///< Накопленная эмиссия такта
      asset                      emission_start; ///< Подвижная граница начала эмиссии в такте
      uint64_t primary_key()const { return 0; } ///< Первичный ключ (1)
   };

   typedef eosio::singleton<"emission"_n, emission_state> emission_state_singleton;




   /**
   * @brief Таблица заказов powerup хранит информацию о заказах на покупку ресурсов через powerup.
   * @ingroup public_tables
   * @ingroup public_system_tables

   * @par Область памяти (scope): eosio.system
   * @par Имя таблицы (table): powup.order
   */
   struct [[eosio::table("powup.order"),eosio::contract("eosio.system")]] powerup_order {
      uint8_t              version = 0; ///< Версия заказа
      uint64_t             id; ///< ID заказа
      name                 owner; ///< Владелец заказа
      int64_t              net_weight; ///< Вес сети
      int64_t              cpu_weight; ///< Вес CPU
      int64_t              ram_bytes; ///< Количество байт RAM
      time_point_sec       expires; ///< Время истечения заказа

      uint64_t primary_key()const { return id; } ///< Первичный ключ (1)
      uint64_t by_owner()const    { return owner.value; } ///< Индекс по владельцу (2)
      uint64_t by_expires()const  { return expires.utc_seconds; } ///< Индекс по времени истечения (3)
   };

   typedef eosio::multi_index< "powup.order"_n, powerup_order,
                               indexed_by<"byowner"_n, const_mem_fun<powerup_order, uint64_t, &powerup_order::by_owner>>,
                               indexed_by<"byexpires"_n, const_mem_fun<powerup_order, uint64_t, &powerup_order::by_expires>>
                               > powerup_order_table;

   /**
    * Параметры финализаторов Savanna (порт setfinalizer из upstream eosio.bios).
    * Этап 1 (bootstrap): политику финализаторов задаёт оператор напрямую.
    * Этап 2 — выборная машинерия финализаторов под кооперативную модель
    * голосования (1 пайщик = 1 голос); upstream-вариант regfinkey/switchtosvnn
    * (top-21 по stake-весу) нашей модели не соответствует и потому не переносится как есть.
    */
   constexpr size_t max_finalizers = 64*1024;
   constexpr size_t max_finalizer_description_size = 256;

   struct finalizer_authority {
      std::string   description; // человеко-читаемое описание финализатора
      uint64_t      weight = 0;  // вес голоса финализатора для достижения threshold
      std::string   public_key;  // BLS-ключ финализатора в формате base64 (PUB_BLS...)
      std::string   pop;         // proof of possession ключа (SIG_BLS...)

      EOSLIB_SERIALIZE(finalizer_authority, (description)(weight)(public_key)(pop))
   };

   struct finalizer_policy {
      uint64_t                         threshold = 0; // порог суммарного веса для финализации
      std::vector<finalizer_authority> finalizers;

      EOSLIB_SERIALIZE(finalizer_policy, (threshold)(finalizers));
   };

   /**
    * The `eosio.system` smart contract is provided by `block.one` as a sample system contract, and it defines the structures and actions needed for blockchain's core functionality.
    *
    * Just like in the `eosio.bios` sample contract implementation, there are a few actions which are not implemented at the contract level (`newaccount`, `updateauth`, `deleteauth`, `linkauth`, `unlinkauth`, `canceldelay`, `onerror`, `setabi`, `setcode`), they are just declared in the contract so they will show in the contract's ABI and users will be able to push those actions to the chain via the account holding the `eosio.system` contract, but the implementation is at the EOSIO core level. They are referred to as EOSIO native actions.
    *
    * - Users can stake tokens for CPU and Network bandwidth, and then vote for producers or
    *    delegate their vote to a proxy.
    * - Producers register in order to be voted for, and can result per-block and per-vote rewards.
    * - Users can buy and sell RAM at a market-determined price.
    * - Users can bid on premium names.
    */
   class [[eosio::contract("eosio.system")]] system_contract : public native {

      private:
         voters_table             _voters;
         producers_table          _producers;
         global_state_singleton   _global;
         eosio_global_state       _gstate;
         rammarket                _rammarket;
         
      public:
         static constexpr eosio::name active_permission{"active"_n};
         static constexpr eosio::name token_account{"eosio.token"_n};
         static constexpr eosio::name ram_account{"eosio.ram"_n};
         static constexpr eosio::name ramfee_account{"eosio.ramfee"_n};
         static constexpr eosio::name stake_account{"eosio.stake"_n};
         static constexpr eosio::name bpay_account{"eosio.bpay"_n};
         static constexpr eosio::name vpay_account{"eosio.vpay"_n};
         static constexpr eosio::name names_account{"eosio.names"_n};
         static constexpr eosio::name null_account{"eosio.null"_n};
         static constexpr symbol ramcore_symbol = symbol(symbol_code("RAMCORE"), 4);
         static constexpr symbol ram_symbol     = symbol(symbol_code("RAM"), 0);
         
         system_contract( name s, name code, datastream<const char*> ds );
         ~system_contract();

          // Returns the core symbol by system account name
          // @param system_account - the system account to get the core symbol for.
         static symbol get_core_symbol( name system_account = "eosio"_n ) {
            rammarket rm(system_account, system_account.value);
            const static auto sym = get_core_symbol( rm );
            return sym;
         }

         // Actions:

          
          
          
          
          // * - and system contract wasn’t already been initialized.
          
         [[eosio::action]]
         void init( uint64_t version, const symbol& core );

        /**
         * @brief Метод миграции вызывается после деплоя для внесения моментальных изменений
         * 
         */
         [[eosio::action]]
         void migrate( );

         /**
          * @brief Инжектирует токены из фонда eosio.saving на кооператив.
          * Требует подписи _soviet для выполнения операции.
          * @param coopname Имя кооператива-получателя
          * @param quantity Сумма для перевода
          * @ingroup public_actions
          * @ingroup public_system_actions
          *
          * @note Авторизация требуется от аккаунта: @p _provider
          */
         [[eosio::action]]
         void injection(const name& coopname, const asset& quantity);

         /**
          * @brief      Метод обновления активного ключа пользователя кооперативами.
          *
          * @param[in]  account     Аккаунт
          * @param[in]  permission  Разрешение
          * @param[in]  parent      Родительское разрешение
          * @param[in]  auth        Авторизация
          */
         [[eosio::action]]
         void changekey(name  account,
                        name  permission,
                        name  parent,
                        authority auth);

         

          [[eosio::action]]
          void setcode( const name& account, uint8_t vmtype, uint8_t vmversion, const std::vector<char>& code, const binary_extension<std::string>& memo );


         /**
          * Инициализация тактовой эмиссии
          * @param tact_duration - продолжительность такта в секундах,
          * @param emission_factor - множитель эмиссии от 0 до 2.618.
          */
         [[eosio::action]]
         void initemission(eosio::asset init_supply, uint64_t tact_duration, double emission_factor);

         

         /**
          * @brief Предложить новую политику финализаторов Savanna.
          * Проверяет BLS-ключи и proof of possession каждого финализатора и
          * передаёт политику в хост-функцию set_finalizers. Вступает в силу,
          * когда не вытеснена более поздней политикой. Первый вызов после
          * активации протокол-фичи SAVANNA запускает переход цепи на
          * instant finality.
          *
          * @param finalizer_policy - предлагаемая политика финализаторов
          *
          * @note Авторизация требуется от аккаунта: @p get_self()
          */
         [[eosio::action]]
         void setfinalizer( const finalizer_policy& finalizer_policy );

         [[eosio::action]]
         void onblock( ignore<block_header> header );


         [[eosio::action]]
         void setalimits( const name& account, int64_t ram_bytes, int64_t net_weight, int64_t cpu_weight );


         [[eosio::action]]
         void setacctram( const name& account, const std::optional<int64_t>& ram_bytes );


         [[eosio::action]]
         void setacctnet( const name& account, const std::optional<int64_t>& net_weight );


         [[eosio::action]]
         void setacctcpu( const name& account, const std::optional<int64_t>& cpu_weight );



         [[eosio::action]]
         void activate( const eosio::checksum256& feature_digest );

         // functions defined in delegate_bandwidth.cpp


         [[eosio::action]]
         void delegatebw( const name& from, const name& receiver,
                          const asset& stake_net_quantity, const asset& stake_cpu_quantity, bool transfer );

         

         [[eosio::action]]
         void undelegatebw( const name& from, const name& receiver,
                            const asset& unstake_net_quantity, const asset& unstake_cpu_quantity );


         [[eosio::action]]
         void buyram( const name& payer, const name& receiver, const asset& quant );


         [[eosio::action]]
         void sellram( const name& account, int64_t bytes );



         [[eosio::action]]
         void buyrambytes( const name& payer, const name& receiver, uint32_t bytes );


         [[eosio::action]]
         void refund( const name& owner );

         // functions defined in voting.cpp


         [[eosio::action]]
         void regproducer( const name& producer, const public_key& producer_key, const std::string& url, uint16_t location );


         [[eosio::action]]
         void regproducer2( const name& producer, const eosio::block_signing_authority& producer_authority, const std::string& url, uint16_t location );


         [[eosio::action]]
         void unregprod( const name& producer );


         [[eosio::action]]
         void setram( uint64_t max_ram_size );


         [[eosio::action]]
         void setramrate( uint16_t bytes_per_block );


         [[eosio::action]]
         void voteproducer( const name& voter, const name& proxy, const std::vector<name>& producers );


         [[eosio::action]]
         void voteupdate( const name& voter_name );


         [[eosio::action]]
         void regproxy( const name& proxy, bool isproxy );


         [[eosio::action]]
         void setparams( const blockchain_parameters_t& params );

#ifdef SYSTEM_CONFIGURABLE_WASM_LIMITS

         [[eosio::action]]
         void wasmcfg( const name& settings );
#endif


         [[eosio::action]]
         void claimrewards( const name& owner );


         [[eosio::action]]
         void setpriv( const name& account, uint8_t is_priv );


         [[eosio::action]]
         void rmvproducer( const name& producer );


         [[eosio::action]]
         void updtrevision( uint8_t revision );


         [[eosio::action]]
         void bidname( const name& bidder, const name& newname, const asset& bid );


         [[eosio::action]]
         void bidrefund( const name& bidder, const name& newname );


         [[eosio::action]]
         void cfgpowerup( powerup_config& args );


         [[eosio::action]]
         void powerupexec( const name& user, uint16_t max );


         [[eosio::action]]
         void powerup(const name& payer, const name& receiver, uint32_t days, const asset& payment, const bool transfer = false);


         [[eosio::action]]
         void limitauthchg( const name& account, const std::vector<name>& allow_perms, const std::vector<name>& disallow_perms );
        
         [[eosio::action]]
         void createaccnt(const name coopname, const name new_account_name, authority owner, authority active);

         using init_action = eosio::action_wrapper<"init"_n, &system_contract::init>;
         using setcode_action = eosio::action_wrapper<"setcode"_n, &system_contract::setcode>;
         using initemission_action = eosio::action_wrapper<"initemission"_n, &system_contract::initemission>;
         using injection_action = eosio::action_wrapper<"injection"_n, &system_contract::injection>;

         using setacctram_action = eosio::action_wrapper<"setacctram"_n, &system_contract::setacctram>;
         using setacctnet_action = eosio::action_wrapper<"setacctnet"_n, &system_contract::setacctnet>;
         using setacctcpu_action = eosio::action_wrapper<"setacctcpu"_n, &system_contract::setacctcpu>;
         
         using activate_action = eosio::action_wrapper<"activate"_n, &system_contract::activate>;
         using delegatebw_action = eosio::action_wrapper<"delegatebw"_n, &system_contract::delegatebw>;
         using undelegatebw_action = eosio::action_wrapper<"undelegatebw"_n, &system_contract::undelegatebw>;
         
         using buyram_action = eosio::action_wrapper<"buyram"_n, &system_contract::buyram>;
         using buyrambytes_action = eosio::action_wrapper<"buyrambytes"_n, &system_contract::buyrambytes>;
         
         using refund_action = eosio::action_wrapper<"refund"_n, &system_contract::refund>;
         
         using regproducer_action = eosio::action_wrapper<"regproducer"_n, &system_contract::regproducer>;
         using regproducer2_action = eosio::action_wrapper<"regproducer2"_n, &system_contract::regproducer2>;
         
         using unregprod_action = eosio::action_wrapper<"unregprod"_n, &system_contract::unregprod>;
         
         using setram_action = eosio::action_wrapper<"setram"_n, &system_contract::setram>;
         using setramrate_action = eosio::action_wrapper<"setramrate"_n, &system_contract::setramrate>;
         
         
         using voteproducer_action = eosio::action_wrapper<"voteproducer"_n, &system_contract::voteproducer>;
         using voteupdate_action = eosio::action_wrapper<"voteupdate"_n, &system_contract::voteupdate>;
         
         using regproxy_action = eosio::action_wrapper<"regproxy"_n, &system_contract::regproxy>;
         
         using resultrewards_action = eosio::action_wrapper<"claimrewards"_n, &system_contract::claimrewards>;
         
         using rmvproducer_action = eosio::action_wrapper<"rmvproducer"_n, &system_contract::rmvproducer>;
         
         using updtrevision_action = eosio::action_wrapper<"updtrevision"_n, &system_contract::updtrevision>;
         
         using bidname_action = eosio::action_wrapper<"bidname"_n, &system_contract::bidname>;
         using bidrefund_action = eosio::action_wrapper<"bidrefund"_n, &system_contract::bidrefund>;
         
         using setpriv_action = eosio::action_wrapper<"setpriv"_n, &system_contract::setpriv>;
         using setalimits_action = eosio::action_wrapper<"setalimits"_n, &system_contract::setalimits>;
         
         using setparams_action = eosio::action_wrapper<"setparams"_n, &system_contract::setparams>;
         
         using cfgpowerup_action = eosio::action_wrapper<"cfgpowerup"_n, &system_contract::cfgpowerup>;
         using powerupexec_action = eosio::action_wrapper<"powerupexec"_n, &system_contract::powerupexec>;
         using powerup_action = eosio::action_wrapper<"powerup"_n, &system_contract::powerup>;
         
      private:
         // Implementation details:

         static symbol get_core_symbol( const rammarket& rm ) {
            auto itr = rm.find(ramcore_symbol.raw());
            check(itr != rm.end(), "system contract must first be initialized");
            return itr->quote.balance.symbol;
         }

         //defined in eosio.system.cpp
         static eosio_global_state get_default_parameters();
         int64_t update_ram_debt_table(name payer, name account, int64_t ram_bytes);
         
         void emit(eosio::asset new_emission);     
         
         symbol core_symbol()const;
         void update_ram_supply();
         
         // defined in delegate_bandwidth.cpp
         void changebw( name from, const name& receiver,
                        const asset& stake_net_quantity, const asset& stake_cpu_quantity, bool transfer );
         void update_voting_power( const name& voter, const asset& total_update );
         
         // defined in voting.cpp
         void register_producer( const name& producer, const eosio::block_signing_authority& producer_authority, const std::string& url, uint16_t location );
         void update_elected_producers( const block_timestamp& timestamp );
         void update_votes( const name& voter, const name& proxy, const std::vector<name>& producers, bool voting );
         void propagate_weight_change( const voter_info& voter );
         
         // defined in power.cpp
         void fill_tact(eosio::name payer, eosio::asset payment);
         void adjust_resources(name payer, name account, symbol core_symbol, int64_t net_delta, int64_t cpu_delta, int64_t ram_delta, bool must_not_be_managed = false);
         void process_powerup_queue(
            time_point_sec now, symbol core_symbol, powerup_state& state,
            powerup_order_table& orders, uint32_t max_items, int64_t& net_delta_available,
            int64_t& cpu_delta_available, int64_t& ram_delta_available);
         emission_state update_tact(emission_state state);
         void change_weights(eosio::name payer, eosio::asset new_emission);
         // defined in block_info.cpp
         void add_to_blockinfo_table(const eosio::checksum256& previous_block_id, const eosio::block_timestamp timestamp) const;
         
   };

}
