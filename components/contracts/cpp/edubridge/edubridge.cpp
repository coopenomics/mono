#include "edubridge.hpp"

// Раскладка по процессам соответствует YAML-стандартам рядом с этим файлом
// (p.edu.access.standard.yaml / p.edu.rid.standard.yaml). Имена подпапок 1:1
// совпадают с process_type — связь от файла → к стандарту прозрачная.

// ── p.edu.access (4 actions) ─── доступ к курсу ────────────────────────
#include "src/p.edu.access/convert.cpp"
#include "src/p.edu.access/opensub.cpp"
#include "src/p.edu.access/extendsub.cpp"
#include "src/p.edu.access/expiresub.cpp"

// ── p.edu.rid (3 actions) ────── паевой взнос РИД преподавателя ────────
#include "src/p.edu.rid/submitrid.cpp"
#include "src/p.edu.rid/acceptrid.cpp"
#include "src/p.edu.rid/declinerid.cpp"
