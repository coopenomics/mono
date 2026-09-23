#pragma once

#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>
#include <string>

/**
 * @brief Тексты в цепи хранятся хешем.
 *
 * Содержательный текст (описание проекта, формулировка вопроса собрания) живёт в
 * базе контроллера, в памяти цепи от него остаётся sha256 в шестнадцатеричной
 * записи нижним регистром (64 символа) или пустая строка, если текста нет. Хеш
 * закрепляет, какой именно текст был, и не занимает память кооператива. Контроллер
 * считает хеш так же (extension-kit, blockchain/chain-text-digest.ts).
 */
namespace TextDigest {

  /**
   * Второй шаг выноса текстов (C28-78). Раскатка ставит контракты раньше
   * контроллера, а только новый контроллер хранит тексты у себя и читает закрытые
   * собрания из журнала дельт. Поэтому в первом релизе, пока в сети может стоять
   * прежний контроллер, контракты:
   * - принимают и текст, и хеш (check_digest ничего не проверяет);
   * - не переводят старые тексты проектов в хеши (capital::migrate);
   * - не стирают закрытые собрания (meet::signbypresid, meet::cleanup).
   * Прежний контроллер записал бы хеш в базу вместо текста и отвергался бы при
   * создании проектов и собраний. Во втором релизе, когда новый контроллер уже
   * раскатан, поставить true — и включить строгие тесты (capital-text-digest,
   * meet-text-digest).
   */
  inline constexpr bool PHASE2 = false;

  /// Значение — хеш текста в принятой записи или пустая строка.
  inline bool is_digest(const std::string &value) {
    if (value.empty()) return true;
    if (value.size() != 64) return false;
    for (char c : value) {
      const bool hex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
      if (!hex) return false;
    }
    return true;
  }

  /// Отказ, если в поле пришёл текст, а не хеш.
  inline void check_digest(const std::string &value, const char *field) {
    if (!PHASE2) return;
    eosio::check(is_digest(value),
      std::string("Поле ") + field + " принимает sha256 текста (64 шестнадцатеричных символа в нижнем регистре) или пустую строку");
  }

  /// sha256 текста в той же записи, что считает контроллер; пустой текст остаётся пустым.
  inline std::string of(const std::string &text) {
    if (text.empty()) return text;
    const auto bytes = eosio::sha256(text.data(), text.size()).extract_as_byte_array();
    static const char *hex = "0123456789abcdef";
    std::string out;
    out.reserve(64);
    for (const auto byte : bytes) {
      out.push_back(hex[(byte >> 4) & 0x0f]);
      out.push_back(hex[byte & 0x0f]);
    }
    return out;
  }

} // namespace TextDigest
