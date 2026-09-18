#pragma once

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>
#include <vector>

using namespace eosio;

struct document {
  checksum256 hash;
  public_key public_key;
  signature signature;
  std::string meta;
};

struct signature_info {
  uint32_t id;
  checksum256 signed_hash;
  name signer;
  public_key public_key;
  signature signature;
  time_point_sec signed_at;
  std::string meta;
};

struct document2 {
  std::string version;
  checksum256 hash;
  checksum256 doc_hash;
  checksum256 meta_hash;
  std::string meta;
  std::vector<signature_info> signatures;
};

void verify_document_or_fail(
    const document2 &doc,
    const std::vector<name> &required_signers = {}) {
  for (const auto &sig : doc.signatures) {
    assert_recover_key(sig.signed_hash, sig.signature, sig.public_key);
  }
  if (!required_signers.empty()) {
    for (const auto &required : required_signers) {
      bool found = false;
      for (const auto &sig : doc.signatures) {
        if (sig.signer == required) {
          found = true;
          break;
        }
      }
      check(found,
            ("Не найдена подпись от обязательного подписанта: " + required.to_string()).c_str());
    }
  }
}

/**
 * Подписи, сделанные от имени @p signer, поставлены ключом его разрешения
 * @p permission. `verify_document_or_fail` сверяет подпись только с ключом,
 * приложенным к ней, — без этой проверки чужим ключом можно подписать документ
 * от имени пайщика. Подписи других подписантов (заверение кооператива и т.п.)
 * не трогаются; наличие подписи @p signer здесь не требуется.
 */
void verify_signer_keys_or_fail(const document2 &doc, name signer, name permission = "active"_n) {
  for (const auto &sig : doc.signatures) {
    if (sig.signer == signer) {
      assert_recover_key_account(sig.signed_hash, sig.signature, sig.public_key, signer, permission);
    }
  }
}

bool is_empty_document(const document2 &doc) {
  return doc.hash == checksum256{};
}
