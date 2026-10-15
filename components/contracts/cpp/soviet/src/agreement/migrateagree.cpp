#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <string>
#include <vector>

/**
 * @brief Миграция соглашения из старой таблицы в новую
 * Переносит запись соглашения из таблицы agreements в agreements2 с обновленной структурой документа.
 * Используется для обновления формата хранения соглашений в системе.
 * @param coopname Наименование кооператива
 * @param agreement_id Идентификатор соглашения для миграции
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void soviet::migrateagree(eosio::name coopname, uint64_t agreement_id) {
    require_auth(coopname);
    
    // Открываем таблицы agreements и agreements2
    agreements_index agreements(_self, coopname.value);
    
    // Находим запись в исходной таблице
    auto agreement_itr = agreements.find(agreement_id);
    eosio::check(agreement_itr != agreements.end(), "Соглашение с указанным ID не найдено");
    
    // Создаем новую структуру document2 на основе document
    document2 new_doc;
    new_doc.version = "0"; // Устанавливаем версию 0
    new_doc.hash = agreement_itr->document.hash; // Общий хэш копируем из исходного документа
    new_doc.doc_hash = agreement_itr->document.hash; // doc_hash равен hash из исходного документа
    new_doc.meta_hash = eosio::checksum256(); // Пустой meta_hash
    new_doc.meta = agreement_itr->document.meta; // Копируем мета-данные
    
    // Добавляем информацию о подписи
    signature_info sig;
    sig.id = 0; // Первая подпись
    sig.signer = agreement_itr->username; // Подписант - это username из agreement
    sig.public_key = agreement_itr->document.public_key; // Копируем публичный ключ
    sig.signature = agreement_itr->document.signature; // Копируем подпись
    sig.signed_at = agreement_itr->updated_at; // Время подписания берем из updated_at
    sig.signed_hash = agreement_itr -> document.hash; // Добавляем signed_hash
    // Добавляем подпись в вектор подписей
    new_doc.signatures.push_back(sig);
    
    // Создаем новую запись в agreement2 с тем же ID
    agreements2_index agreements2(_self, coopname.value);
    
    agreements2.emplace(RamPayer::of(agreements2, coopname), [&](auto& new_agreement) {
        new_agreement.id = agreement_itr->id;
        new_agreement.coopname = agreement_itr->coopname;
        new_agreement.username = agreement_itr->username;
        new_agreement.type = agreement_itr->type;
        new_agreement.program_id = agreement_itr->program_id;
        new_agreement.draft_id = agreement_itr->draft_id;
        new_agreement.version = agreement_itr->version;
        new_agreement.document = new_doc;
        new_agreement.status = agreement_itr->status;
        new_agreement.updated_at = agreement_itr->updated_at;
    });
    
    // Удаляем запись из исходной таблицы
    // agreements.erase(agreement_itr);
}
