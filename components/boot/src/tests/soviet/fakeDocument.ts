// Алиас на shared/fakeDocument с правильной IDocument2-схемой (version, doc_hash,
// meta_hash, signatures[]). Старая схема (только hash/public_key/signature/meta)
// не сериализуется как document2 → "missing document2.version".
export { fakeDocument } from '../shared/fakeDocument'
