#include "edubridge.hpp"

// Раскладка по процессам соответствует YAML-стандартам рядом с этим файлом
// (p.edu.access.standard.yaml / p.edu.rid.standard.yaml). Имена подпапок 1:1
// совпадают с process_type — связь от файла → к стандарту прозрачная.

// ── p.edu.access (11 actions) ─── доступ к курсу, p.edu.spend (2) — расходы ──
#include "src/p.edu.access/convert.cpp"
#include "src/p.edu.access/setcourse.cpp"
#include "src/p.edu.access/opensub.cpp"
#include "src/p.edu.access/chargefee.cpp"
#include "src/p.edu.access/unlockfee.cpp"
#include "src/p.edu.access/regstatement.cpp"
#include "src/p.edu.access/warrclaim.cpp"
#include "src/p.edu.access/warrgrant.cpp"
#include "src/p.edu.access/cancelsub.cpp"
#include "src/p.edu.access/retshare.cpp"
#include "src/p.edu.spend/createexp.cpp"
#include "src/p.edu.spend/onexpdone.cpp"
#include "src/p.edu.access/expiresub.cpp"

// ── p.edu.rid (14 actions) ───── паевой взнос РИД преподавателя ────────
#include "src/p.edu.rid/openlesson.cpp"
#include "src/p.edu.rid/chargelesson.cpp"
#include "src/p.edu.rid/holdrid.cpp"
#include "src/p.edu.rid/submitrid.cpp"
#include "src/p.edu.rid/onridauth.cpp"
#include "src/p.edu.rid/onriddecl.cpp"
#include "src/p.edu.rid/accept_rid.cpp"
#include "src/p.edu.rid/signridact.cpp"
#include "src/p.edu.rid/apprvridact.cpp"
#include "src/p.edu.rid/dclridact.cpp"
#include "src/p.edu.rid/acceptrid.cpp"
#include "src/p.edu.rid/declinerid.cpp"
#include "src/p.edu.rid/recallrid.cpp"
#include "src/p.edu.rid/wthshare.cpp"

// ── p.edu.teach (6 actions) ──── договор УХД через одобрение, допуски ──
#include "src/p.edu.teach/signcontract.cpp"
#include "src/p.edu.teach/apprvcontr.cpp"
#include "src/p.edu.teach/dclinecontr.cpp"
#include "src/p.edu.teach/termcontract.cpp"
#include "src/p.edu.teach/setassign.cpp"

/**
 * @brief Очистка отработавших записей (lib/core/cleanup.hpp).
 *
 * Правил нет: контракт новый, строк прежних версий в цепи нет, а процессы
 * удаляют свои записи на терминальном шаге сами. Учёт средств курса
 * (`educourses`) очистке не подлежит: его суммы — рабочее состояние, по ним
 * оплачиваются результаты преподавателей. Действие есть, потому что
 * раскатка вызывает `cleanup` у каждого прикладного контракта.
 *
 * @note Авторизация требуется от аккаунта контракта.
 */
void edubridge::cleanup() {
  require_auth(get_self());
  Cleanup::budget budget;
  Cleanup::report(get_self(), budget);
}
