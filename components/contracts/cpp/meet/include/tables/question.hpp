namespace Meet {
/**
  * @brief Структура вопросов повестки дня собрания.
  * @ingroup public_tables
  * @ingroup public_meet_tables

  * @par Область памяти (scope): coopname
  * @par Имя таблицы (table): questions
  */
struct [[eosio::table, eosio::contract(MEET)]] question {
    uint64_t id;                                 ///< Идентификатор вопроса
    uint64_t number;                             ///< Номер вопроса в повестке
    name coopname;                               ///< Имя кооператива
    uint64_t meet_id;                            ///< Идентификатор общего собрания
    
    std::string title;                           ///< sha256 текста вопроса (текст — в базе контроллера)
    std::string context;                         ///< sha256 контекста вопроса или пустая строка
    std::string decision;                        ///< sha256 проекта решения по вопросу
    
    uint64_t counter_votes_for;                  ///< Счётчик голосов за
    uint64_t counter_votes_against;              ///< Счётчик голосов против
    uint64_t counter_votes_abstained;            ///< Счётчик воздержавшихся голосов
    
    std::vector<name> voters_for;                ///< Проголосовавшие за
    std::vector<name> voters_against;            ///< Проголосовавшие против
    std::vector<name> voters_abstained;          ///< Воздержавшиеся

    uint64_t primary_key() const { return id; } ///< Основной ключ
    uint64_t by_meet_key() const { return meet_id; } ///< Ключ по идентификатору собрания
};

typedef eosio::multi_index<
    "questions"_n, question,
    indexed_by<"bymeet"_n, const_mem_fun<question, uint64_t, &question::by_meet_key>>
> questions_index;

}

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Meet::question, cooperative);
