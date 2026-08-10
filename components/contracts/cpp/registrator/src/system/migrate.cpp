#include <array>

/**
 * @brief Миграция данных контракта.
 * Обновляет счетчики активных пайщиков для всех кооперативов
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p registrator
 */
[[eosio::action]] void registrator::migrate() {
  require_auth(_registrator);
  
  // Получаем таблицу кооперативов
  cooperatives2_index coops2(_registrator, _registrator.value);
  
  // Для каждого кооператива проверяем наличие счетчика активных пайщиков
  for (auto coop_itr = coops2.begin(); coop_itr != coops2.end(); ++coop_itr) {
    // Если счетчик активных пайщиков уже установлен, пропускаем кооператив
    if (coop_itr->active_participants_count.has_value()) {
      continue;
    }
    
    // Получаем имя кооператива для использования как scope
    eosio::name coopname = coop_itr->username;
    
    // Получаем таблицу участников из контракта soviet с scope кооператива
    participants_index participants(_soviet, coopname.value);
    
    // Счетчик активных пайщиков
    uint64_t active_count = 0;
    
    // Проходим по всем участникам и считаем активных (has_vote == true)
    for (auto part_it = participants.begin(); part_it != participants.end(); ++part_it) {
      if (part_it->has_vote) {
        active_count++;
      }
    }
    
    // Обновляем запись кооператива, устанавливая счетчик активных пайщиков
    coops2.modify(coop_itr, _registrator, [&](auto& coop) {
      coop.active_participants_count = active_count;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Разовая очистка ФАНТОМНЫХ пайщиков кооператива fgrtejiwnynn (инцидент
  // 2026-06-04). Причина: install.interactor прогнан 3× (2 провала + успех);
  // каждый прогон минтил на цепи новые аккаунты совета (adduser) со случайным
  // username, а откат в catch чистил только off-chain. На цепи осели 6 дублей-
  // аккаунтов одних и тех же 3 учредителей (см. ~/gorozhane-dup-install-cleanup.md
  // и ~/fixes.md). Удаляем записи registrator::accounts и пересчитываем счётчик
  // активных пайщиков из soviet::participants (источник истины).
  //
  // Список username — единственный авторитет (дедуп off-chain по ФИО невозможен
  // on-chain — личных данных в registrator::accounts нет). ОДИН И ТОТ ЖЕ список
  // продублирован в soviet::migrate и ledger2::migrate — править синхронно.
  // Идемпотентно: повторный прогон не находит записей → no-op.
  {
    const eosio::name PHANTOM_COOP = "fgrtejiwnynn"_n;
    const std::array<eosio::name, 6> PHANTOMS = {
      "bbsezpgufvmm"_n, "errwcgjwverm"_n, "hcfsluqsfehw"_n,
      "kgkzdadfpzki"_n, "nzuyijobapsv"_n, "tplwfwbujugq"_n,
    };

    auto pcoop = coops2.find(PHANTOM_COOP.value);
    if (pcoop != coops2.end() && pcoop->is_cooperative) {
      accounts_index accounts(_registrator, _registrator.value);

      for (const auto& u : PHANTOMS) {
        auto acc = accounts.find(u.value);
        if (acc == accounts.end()) continue;            // уже удалён / отсутствует
        // Дедуп-гард: трогаем только аккаунты, зарегистрированные ЭТИМ коопом.
        if (acc->registrator != PHANTOM_COOP) continue;
        accounts.erase(acc);
      }

      // Пересчитываем счётчик активных пайщиков из реестра soviet::participants
      // (источник истины), ИСКЛЮЧАЯ фантомов явно — счётчик сходится к верному
      // значению за ОДИН деплой независимо от порядка выполнения migrate
      // (registrator::migrate vs soviet::migrate). Если бы считали всех has_vote,
      // а soviet ещё не удалил фантомов — счётчик временно завысился бы.
      participants_index pparts(_soviet, PHANTOM_COOP.value);
      uint64_t active = 0;
      for (auto p = pparts.begin(); p != pparts.end(); ++p) {
        bool is_phantom = false;
        for (const auto& ph : PHANTOMS) {
          if (ph == p->username) { is_phantom = true; break; }
        }
        if (!is_phantom && p->has_vote) active++;
      }
      coops2.modify(pcoop, _registrator, [&](auto& coop) {
        coop.active_participants_count = active;
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Оператор существующих кооперативов (2026-08-10).
  //
  // Поле «родитель» лежало в реестре с самого начала и не заполнялось ничем: ни
  // одно действие в него не писало, и на всех сетях оно пусто у всех. Задумано
  // оно было не под дочерние организации — кооперативы друг друга не учреждают,
  // такой связи в кооперации нет, — а под ту единственную связь, которая между
  // ними есть: кто чью установку держит.
  //
  // Смысл полю придан задачей о цепочке доверия: оператор обязан продлевать
  // заверения обслуживаемым кооперативам, иначе удостоверения их пайщиков
  // перестают подтверждаться. Обходить их по расписанию он может, только зная,
  // кто это.
  //
  // Все подключённые кооперативы обслуживает провайдер платформы: их установки
  // разворачивал он. Сам провайдер держит свою установку сам, и родитель у него
  // остаётся пустым — пустой родитель это и означает.
  //
  // Заблокированные и ожидающие мигрируются наравне с действующими: статус
  // говорит о состоянии кооператива, а не о том, кто его обслуживает. Выдачу и
  // продление заверений статус ограничивает отдельно.
  //
  // Идемпотентно: заполненный родитель не трогается, повторный прогон ничего не
  // меняет.
  //
  // Оговорка, о которой лучше знать: кооперативу, у которого оператора сняли
  // намеренно, следующий деплой проставит провайдера обратно — миграция ведь
  // отличает «не заполнено» от «снято» только по пустоте, а другого признака в
  // записи нет. Пока собственных установок ни у кого, кроме провайдера, нет, это
  // безвредно; когда появятся, признак придётся завести явный.
  for (auto it = coops2.begin(); it != coops2.end(); ++it) {
    if (!it->is_cooperative) continue;
    if (it->username == _provider) continue;
    if (it->parent_username != eosio::name()) continue;

    coops2.modify(it, _registrator, [&](auto& coop) {
      coop.parent_username = _provider;
    });
  }
}