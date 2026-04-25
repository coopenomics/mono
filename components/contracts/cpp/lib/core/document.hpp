#pragma once

#include "../domain/document_core.hpp"
#include "utils.hpp"

namespace Document {
  /**
   * @brief Проверяет, что переданный документ соответствует ожидаемому шаблону
   * @param document Документ для проверки
   * @param expected_registry_id Ожидаемый идентификатор шаблона
   */
  inline void validate_registry_id(document2 document, uint64_t expected_registry_id) {
    uint64_t registry_id = extract_registry_id_from_meta(document.meta);
    eosio::check(registry_id == expected_registry_id, "Передан неверный шаблон документа");
  }

  /*!
   *  \brief Структура именованного документа
   */
  struct named_document {
    name name;      /*!< имя документа (до 12 символов) */
    document2 document;    /*!< сам документ */
  };

  /**
   * @brief Добавить документ с проверкой длины имени
   * @param docs Вектор документов
   * @param name Имя документа
   * @param doc Документ
   */
  inline void add_document(std::vector<named_document>& docs, const name& name, const document2& doc) {
    docs.push_back({name, doc});
  }
  
  /**
   * @brief Найти документ по имени
   * @param docs Вектор документов
   * @param name Имя для поиска
   * @param found_doc Найденный документ (выходной параметр)
   * @return true если документ найден
   */
  inline bool find_document(const std::vector<named_document>& docs, const name& name, document2& found_doc) {
    for (const auto& nd : docs) {
      if (nd.name == name) {
        found_doc = nd.document;
        return true;
      }
    }
    return false;
  }
  
  /**
   * @brief Проверить наличие документа
   * @param docs Вектор документов
   * @param name Имя для поиска
   * @return true если документ найден
   */
  inline bool has_document(const std::vector<named_document>& docs, const name& name) {
    for (const auto& nd : docs) {
      if (nd.name == name) {
        return true;
      }
    }
    return false;
  }

  /**
   * @brief Проверить, является ли документ пустым по хэшу
   * @param document Документ для проверки
   * @return true если документ пустой (хэш равен empty_hash)
   */
  inline bool is_document_empty(const document2& document) {
    return document.hash == checksum256{};
  }

  /**
   * @brief Удалить документ по имени из вектора
   * @param docs Вектор документов
   * @param name Имя документа для удаления
   * @return true если документ был найден и удалён
   */
  inline bool remove_document(std::vector<named_document>& docs, const name& name) {
    for (auto it = docs.begin(); it != docs.end(); ++it) {
      if (it->name == name) {
        docs.erase(it);
        return true;
      }
    }
    return false;
  }

}