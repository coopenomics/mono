#include "edubridge.hpp"

// Раскладка по процессам соответствует YAML-стандартам рядом с этим файлом
// (p.edu.access.standard.yaml / p.edu.rid.standard.yaml). Имена подпапок 1:1
// совпадают с process_type — связь от файла → к стандарту прозрачная.

// ── p.edu.access (7 actions) ─── доступ к курсу, p.edu.spend (2) — расходы ──
#include "src/p.edu.access/convert.cpp"
#include "src/p.edu.access/opensub.cpp"
#include "src/p.edu.access/chargefee.cpp"
#include "src/p.edu.access/cancelsub.cpp"
#include "src/p.edu.access/retshare.cpp"
#include "src/p.edu.spend/createexp.cpp"
#include "src/p.edu.spend/onexpdone.cpp"
#include "src/p.edu.access/extendsub.cpp"
#include "src/p.edu.access/expiresub.cpp"

// ── p.edu.rid (5 actions) ────── паевой взнос РИД преподавателя ────────
#include "src/p.edu.rid/holdrid.cpp"
#include "src/p.edu.rid/submitrid.cpp"
#include "src/p.edu.rid/acceptrid.cpp"
#include "src/p.edu.rid/declinerid.cpp"
#include "src/p.edu.rid/recallrid.cpp"

// ── p.edu.teach (7 actions) ──── договор УХД и приложения через одобрение ──
#include "src/p.edu.teach/signcontract.cpp"
#include "src/p.edu.teach/apprvcontr.cpp"
#include "src/p.edu.teach/dclinecontr.cpp"
#include "src/p.edu.teach/signannex.cpp"
#include "src/p.edu.teach/apprvannex.cpp"
#include "src/p.edu.teach/dclineannex.cpp"
#include "src/p.edu.teach/termcontract.cpp"
