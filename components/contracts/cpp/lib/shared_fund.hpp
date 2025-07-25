namespace Fund {
  
  /**
   * @brief Добавляет средства в циркулирующий фонд кооператива
   * @param contract Контракт-отправитель (обычно _marketplace)
   * @param coopname Имя кооператива
   * @param amount Сумма для добавления
   */
  inline void add_circulating_funds(eosio::name contract, eosio::name coopname, eosio::asset amount) {
    action(
        permission_level{ contract, "active"_n },
        _fund,
        "addcirculate"_n,
        std::make_tuple(coopname, amount)
    ).send();
  }
  
  /**
   * @brief Списывает средства из циркулирующего фонда кооператива
   * @param contract Контракт-отправитель (обычно _marketplace)
   * @param coopname Имя кооператива
   * @param amount Сумма для списания
   * @param skip_available_check Пропустить проверку доступных средств
   */
  inline void sub_circulating_funds(eosio::name contract, eosio::name coopname, eosio::asset amount, bool skip_available_check = false) {
    action(
        permission_level{ contract, "active"_n },
        _fund,
        "subcirculate"_n,
        std::make_tuple(coopname, amount, skip_available_check)
    ).send();
  }
  
  /**
   * @brief Добавляет средства на счёт вступительных взносов кооператива
   * @param contract Контракт-отправитель (обычно _registrator)
   * @param coopname Имя кооператива
   * @param amount Сумма для добавления
   */
  inline void add_initial_funds(eosio::name contract, eosio::name coopname, eosio::asset amount) {
    action(
        permission_level{ contract, "active"_n },
        _fund,
        "addinitial"_n,
        std::make_tuple(coopname, amount)
    ).send();
  }
  
  // /**
  //  * @brief Добавляет членский взнос на накопительный счет кооператива для дальнейшего управления
  //  * @param contract Контракт-отправитель
  //  * @param coopname Имя кооператива
  //  * @param amount Сумма членского взноса
  //  */
  // inline void accumulate_fee(eosio::name contract, eosio::name coopname, eosio::asset amount) {
  //   action(
  //       permission_level{ contract, "active"_n },
  //       _fund,
  //       "accumfee"_n,
  //       std::make_tuple(coopname, amount)
  //   ).send();
  // }
}
