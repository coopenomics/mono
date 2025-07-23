#pragma once
/**
 * @ingroup public_tables
 * @brief Структура, представляющая членов совета (борда).
 * @details Эта структура содержит информацию о членах борда, включая их уникальные имена, статус участия в голосовании,
 * название должности и позицию в доске.
 */
struct board_member {
  eosio::name username; ///< Уникальное имя члена доски.
  bool is_voting; ///< Флаг, указывающий, имеет ли член доски право голоса.
  std::string position_title; ///< Название должности члена доски.
  eosio::name position; ///< Позиция члена в доске:
  // (CHAIRMAN, _('chairman')),
  // (CHAIRMAN_VP, _('vpchairman')),
  // (SECRETARY, _('secretary')),
  // (ACCOUNTING, _('accounting')),
  // (MEMBER, _('member')),
  // (INVITED, _(‘invited')),
};

/**
 * @ingroup public_tables
 * @brief Структура советов кооперативов
 * @details Эта структура содержит информацию о досках кооператива, их типе, названии, описании и членах.
 */
struct [[eosio::table, eosio::contract(SOVIET)]] boards {
  uint64_t id; ///< Уникальный идентификатор доски.
  eosio::name type; ///< Тип доски:
  // (soviet, _('Board of Members')),   # Совет кооператива
  // (executive, _('Executive Board')), # Правление
  // (audit, _('Audit and Revision Board')),  # Ревизионный
  // (other, _('Other committee')),   # Другая комиссия
  std::string name; ///< Название доски.
  std::string description; ///< Описание доски.
  
  std::vector<board_member> members; ///< Список членов доски.

  eosio::time_point_sec created_at; ///< Время создания доски.
  eosio::time_point_sec last_update; ///< Время последнего обновления информации о доске.


  /**
   * @brief Возвращает первичный ключ доски.
   * @return uint64_t - первичный ключ, равный уникальному идентификатору доски.
   */
  uint64_t primary_key() const { return id; }

  /**
   * @brief Возвращает ключ для индексации по типу доски.
   * @return uint64_t - ключ, равный значению типа доски.
   */
  uint64_t by_type() const { return type.value; }

  bool is_valid_member(eosio::name member) const {
    for (const auto& m : members) {
      if (m.username == member)
        return true;
    }
    return false;
  }
 
  bool is_voting_member(eosio::name member) const {
    for (const auto& m : members) {
      if (m.username == member && m.is_voting == true)
        return true;
    }
    return false;
  }


  bool is_valid_chairman(eosio::name chairman) const {
    for (const auto& m : members) {
      if (m.username == chairman && (m.position == "chairman"_n || m.position == "vpchairman"_n))
        return true;
    }
    return false;
  }

  eosio::name get_chairman() const {
    for (const auto& m : members) {
      if (m.position == "chairman"_n)
        return m.username;
    }
    return ""_n;
  };

  bool is_valid_secretary(eosio::name secretary) const {
    for (const auto& m : members) {
      if (m.username == secretary && (m.position == "secretary"_n))
        return true;
    }
    return false;
  }

  bool has_voting_right(eosio::name member) const {
    for (const auto& m : members) {
        if (m.username == member && m.is_voting)
            return true;
    }
    return false;
  }


  uint64_t get_members_count() const {
    return members.size();
  };

};

typedef eosio::multi_index< "boards"_n, boards,
eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<boards, uint64_t,
                                                       &boards::by_type>>> boards_index;


/**
 * @ingroup public_structs
 * @brief Структура, представляющая права доступа.
 * @details Эта структура содержит информацию о правах доступа, связанных с конкретным контрактом и действием.
 */
struct right {
  eosio::name contract; ///< Имя контракта, к которому применяется право доступа.
  eosio::name action_name; ///< Имя действия, к которому применяется право доступа.
};

/**
 * @ingroup public_tables
 * @brief Структура, представляющая администраторов кооператива.
 * @details Эта структура содержит информацию об администраторах, их уникальных именах, должностях и правах.
 */
struct [[eosio::table, eosio::contract(SOVIET)]] staff {
  eosio::name username; ///< Уникальное имя администратора.
  std::string position_title; ///< Название должности администратора.
  std::vector<eosio::name> roles; ///< Список ролей.
  std::vector<right> rights; ///< Список прав администратора.
  eosio::time_point_sec created_at; ///< Время создания записи об администраторе.
  eosio::time_point_sec updated_at; ///< Время последнего обновления информации об администраторе.

  uint64_t primary_key() const { return username.value; } ///< Первичный ключ для индексации по имени администратора

  bool has_right(eosio::name contract, eosio::name action_name) const {
    for (const auto& r : rights) {
        if (r.contract == contract && r.action_name == action_name) {
            return true;
        }
    }
    return false;
  }
};

typedef eosio::multi_index<"staff"_n, staff> staff_index; ///< Тип мультииндекса для таблицы администраторов


/**
 * @ingroup public_tables
 * @brief Структура, представляющая членов кооператива.
 * @details Эта структура содержит информацию о членах кооператива, включая их уникальные имена, дату создания, дату последнего обновления,
 * дату последнего минимального платежа, должность, позицию, флаги их статуса и участия.
 */
struct [[eosio::table, eosio::contract(SOVIET)]] participant {
  eosio::name username; ///< Уникальное имя члена кооператива.
  eosio::time_point_sec created_at; ///< Время создания записи о члене.
  eosio::time_point_sec last_update; ///< Время последнего обновления информации о члене.
  eosio::time_point_sec last_min_pay; ///< Время последнего минимального платежа.

  eosio::name status; //accepted | blocked

  bool is_initial = true; ///< флаг, указывающий, внесен ли регистрационный взнос.
  bool is_minimum = true; ///< флаг, указывающий, внесен ли минимальный паевой взнос.
  bool has_vote = true; ///< флаг, указывающий, имеет ли член право голоса.
  
  eosio::binary_extension<eosio::name> type; ///< individual | entrepreneur | organization
  eosio::binary_extension<eosio::name> braname; ///< имя кооперативного участка

  eosio::binary_extension<eosio::asset> initial_amount; ///< внесенный вступительный взнос
  eosio::binary_extension<eosio::asset> minimum_amount; ///< внесенный минимальный паевой взнос
  
  /**
   * @brief Возвращает первичный ключ учетной записи члена кооператива.
   * @return uint64_t - первичный ключ, равный значению имени члена кооператива.
   */
  uint64_t primary_key() const {
    return username.value;
  } /*!< return username - primary_key */

  /**
   * @brief Возвращает ключ для индексации по времени последнего минимального платежа.
   * @return uint64_t - ключ, равный количеству секунд с начала эпохи Unix.
   */
  uint64_t bylastpay() const {
    return last_min_pay.sec_since_epoch();
  }

  /**
   * @brief Возвращает ключ для индексации по времени создания
   * @return uint64_t - ключ, равный количеству секунд с начала эпохи Unix.
   */
  uint64_t by_created_at() const {
    return created_at.sec_since_epoch();
  }

  bool is_active() const {
    return status == "accepted"_n;
  }
  
  uint64_t by_braname() const {
    return braname.has_value() ? braname -> value : 0; // Проверка на наличие значения
  }

};

typedef eosio::multi_index< "participants"_n, participant,
  eosio::indexed_by<"bylastpay"_n, eosio::const_mem_fun<participant, uint64_t, &participant::bylastpay>>,
  eosio::indexed_by<"createdat"_n, eosio::const_mem_fun<participant, uint64_t, &participant::by_created_at>>,
  eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<participant, uint64_t, &participant::by_braname>>
> participants_index;


/**
 * @ingroup public_tables
 * @brief Структура, представляющая решения кооператива.
 * @details Эта структура содержит информацию о решениях, включая уникальный идентификатор, имя кооператива, тип решения,
 * идентификатор карточки, списки голосов "за" и "против", а также различные флаги состояния решения.
 */
struct [[eosio::table, eosio::contract(SOVIET)]] decision {
  uint64_t id; ///< Уникальный идентификатор решения.
  eosio::name coopname; ///< Имя кооператива, связанного с решением.
  eosio::name username; ///< Имя пользователя, связанного с решением.
  
  eosio::name type; ///< Тип решения: // joincoop | change | ...
  uint64_t batch_id; ///< Идентификатор карточки, связанной с типом решения.
  document2 statement; ///< Документ заявления
  
  std::vector<eosio::name> votes_for; ///< Список имен, голосовавших "за" решение.
  std::vector<eosio::name> votes_against; ///< Список имен, голосовавших "против" решения.
  
  bool validated = false; ///< Сигнальный флаг, указывающий, что администратор подтверждает валидность решения.
  bool approved = false; ///< Сигнальный флаг, указывающий, что решение советом принято.
  bool authorized = false; ///< Флаг, указывающий, что получена авторизация председателя после голосования и валидации до исполнения.
  eosio::name authorized_by; ///< Имя аккаунта председателя
  document2 authorization; ///< Документ подписанного решения председателем

  eosio::time_point_sec created_at; ///< Время создания карточки решения.
  
  eosio::binary_extension<eosio::time_point_sec> expired_at; ///< Время до истечения
  eosio::binary_extension<std::string> meta; ///< мета-данные
  
  eosio::binary_extension<name> callback_contract; ///< контракт для вызова после принятия решения
  eosio::binary_extension<name> confirm_callback; ///< действие для вызова после принятия решения
  eosio::binary_extension<name> decline_callback; ///< действие для вызова после отклонения решения
  eosio::binary_extension<checksum256> hash; ///< входящий идентификатор решения
  
  /**
   * @brief Возвращает первичный ключ решения.
   * @return uint64_t - первичный ключ, равный уникальному идентификатору решения.
   */
  uint64_t primary_key() const { return id; }

  /**
   * @brief Возвращает ключ для индексации по идентификатору карточки.
   * @return uint64_t - ключ, равный идентификатору карточки.
   */
  uint64_t by_secondary() const { return batch_id; }

  /**
   * @brief Возвращает ключ для индексации по типу решения.
   * @return uint64_t - ключ, равный значению типа решения.
   */
  uint64_t bytype() const { return type.value; }

  /**
   * @brief Возвращает ключ для индексации по статусу "принято".
   * @return uint64_t - ключ, равный статусу "принято" (1, если решение принято, иначе 0).
   */
  uint64_t byapproved() const { return approved; }

  /**
   * @brief Возвращает ключ для индексации по статусу "подтверждено".
   * @return uint64_t - ключ, равный статусу "подтверждено" (1, если решение подтверждено, иначе 0).
   */
  uint64_t byvalidated() const { return validated; }

  /**
   * @brief Возвращает ключ для индексации по статусу "авторизовано".
   * @return uint64_t - ключ, равный статусу "авторизовано" (1, если решение авторизовано, иначе 0).
   */
  uint64_t byauthorized() const { return authorized; }

  
  checksum256 byhash() const { return hash.value(); }


  void check_for_any_vote_exist(eosio::name member) const {
    // Проверяем, есть ли имя участника в голосах за
    eosio::check(std::find(votes_for.begin(), votes_for.end(), member) == votes_for.end(), "Участник уже голосовал за данное решение.");

    // Проверяем, есть ли имя участника в голосах против
    eosio::check(std::find(votes_against.begin(), votes_against.end(), member) == votes_against.end(), "Участник уже голосовал против данного решения.");
  };

  std::pair<uint64_t, uint64_t> get_votes_count() const {
    return std::make_pair(votes_for.size(), votes_against.size());
  };
};


typedef eosio::multi_index< "decisions"_n, decision,
  eosio::indexed_by<"bysecondary"_n, eosio::const_mem_fun<decision, uint64_t, &decision::by_secondary>>,
  eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<decision, uint64_t, &decision::bytype>>,
  eosio::indexed_by<"byapproved"_n, eosio::const_mem_fun<decision, uint64_t, &decision::byapproved>>,
  eosio::indexed_by<"byvalidated"_n, eosio::const_mem_fun<decision, uint64_t, &decision::byvalidated>>,
  eosio::indexed_by<"byauthorized"_n, eosio::const_mem_fun<decision, uint64_t, &decision::byauthorized>>,
  eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<decision, checksum256, &decision::byhash>>
> decisions_index;


boards get_board_by_id(eosio::name coopname, uint64_t board_id){
  boards_index boards(_soviet, coopname.value);
  auto board = boards.find(board_id);
  
  eosio::check(board != boards.end(), "Совет не найден");

  return *board; 

};


boards get_board_by_type_or_fail(eosio::name coopname, eosio::name type){
  boards_index boards(_soviet, coopname.value);
  auto boards_by_type_index = boards.template get_index<"bytype"_n>();
  auto exist = boards_by_type_index.find(type.value);
  
  eosio::check(exist != boards_by_type_index.end(), "Совет не найден");

  return *exist;

};


bool check_for_exist_board_by_type(eosio::name coopname, eosio::name type){
  boards_index boards(_soviet, coopname.value);

  auto boards_by_type_index = boards.template get_index<"bytype"_n>();

  auto exist = boards_by_type_index.find(type.value);
  
  if (exist != boards_by_type_index.end())
    return true;
  else return false;
}

struct address_data {
  std::string full_address;
  std::string latitude;
  std::string longitude;
  std::string country;
  std::string state;
  std::string city;
  std::string district;
  std::string street;
  std::string house_number;
  std::string building_section;
  std::string unit_number;
  std::string directions; //как добраться
  std::string phone_number;
  std::string email;
  std::string business_hours;  
  std::string meta;
};


/**
 * @ingroup public_tables
 * @brief Структура, представляющая адреса кооператива.
 * @details Эта структура содержит информацию о адресах кооператива, которые используются как точки приёма-выдачи товаров на кооплейсе.
 */
struct [[eosio::table, eosio::contract(SOVIET)]] address {
  uint64_t id;
  eosio::name coopname;
  eosio::name braname;
  address_data data;
  
  uint64_t primary_key() const { return id; }
};


typedef eosio::multi_index< "addresses"_n, address> addresses_index;



bool is_valid_participant(eosio::name coopname, eosio::name username) {
  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);
  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);
  
  if (
    participant != participants.end() && 
    participant->status == "accepted"_n
  ) 
  {
    return true;
  }
  
  return false;
}


participant get_participant_or_fail(eosio::name coopname, eosio::name username){
  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);
  eosio::check(participant != participants.end(), "Пайщик не найден в кооперативе");
  eosio::check(participant -> status != "blocked"_n, "Пайщик заблокирован");
  
  return *participant;
}



