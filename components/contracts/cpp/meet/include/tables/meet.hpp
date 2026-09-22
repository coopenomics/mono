namespace Meet {
  
/**
  * @brief Структура действий, хранящая данные о выполненных операциях.
  * @ingroup public_tables
  * @ingroup public_meet_tables

  * @par Область памяти (scope): coopname
  * @par Имя таблицы (table): meets
  */
struct [[eosio::table, eosio::contract(MEET)]] meet {
    uint64_t id;                                 ///< Идентификатор собрания
    checksum256 hash;                            ///< Внешний хэш-идентификатор собрания
    name coopname;                               ///< Имя кооператива
    name type;                                   ///< Тип общего собрания (regular | extra)
    name level;                                  ///< Уровень общего собрания (cooperative | branch)
    name initiator;                              ///< Имя пользователя, который инициировал собрание
    name presider;                               ///< Имя аккаунта председателя собрания
    name secretary;                              ///< Имя аккаунта секретаря собрания

    name status;                                 ///< Статус коммита (created | authorized | pending | opened | closed )
    
    time_point_sec created_at;                   ///< Дата создания предложения
    time_point_sec open_at;                      ///< Дата начала собрания
    time_point_sec close_at;                     ///< Дата завершения собрания
    std::vector<name> notified_users;            ///< Пользователи, которые подписали уведомление
    
    double quorum_percent = 75.0;                ///< Цель по кворуму, чтобы собрание считалось состоявшимся
    uint64_t signed_ballots;                     ///< Общее количество подписанных бюллетеней
    double current_quorum_percent = 0;           ///< Текущий процент кворума
    uint64_t cycle = 1;                          ///< Цикл общего собрания, который указывает на то, что были предыдущие собрания, которые не состоялись по кворуму
    bool quorum_passed = false;                  ///< Флаг пройденного кворума
    
    document2 proposal;                          ///< Предложение
    document2 authorization;                     ///< Решение совета
    document2 decision1;                         ///< Подпись протокола секретарём общего собрания
    document2 decision2;                         ///< Подпись протокола председателем общего собрания
    
    uint64_t primary_key() const { return id; } ///< Основной ключ
    checksum256 by_hash() const { return hash;} ///< Хэш-ключ
    uint64_t by_initiator() const { return initiator.value; } ///< По имени пользователя
    uint64_t by_open_at() const { return open_at.sec_since_epoch(); }///< По дате открытия
    uint64_t by_close_at() const { return close_at.sec_since_epoch(); }///< По дате закрытия
};

typedef eosio::multi_index<
    "meets"_n, meet,
    indexed_by<"byhash"_n, const_mem_fun<meet, checksum256, &meet::by_hash>>,
    indexed_by<"byinitiator"_n, const_mem_fun<meet, uint64_t, &meet::by_initiator>>,
    indexed_by<"byopenat"_n, const_mem_fun<meet, uint64_t, &meet::by_open_at>>,
    indexed_by<"bycloseat"_n, const_mem_fun<meet, uint64_t, &meet::by_close_at>>
> meets_index;

}

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Meet::meet, cooperative);
