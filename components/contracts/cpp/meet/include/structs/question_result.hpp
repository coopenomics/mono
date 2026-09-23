// Например, во внешем header можно объявить структуру:
/// Итог по вопросу; title, decision, context — sha256 формулировок, тексты в базе контроллера.
struct question_result {
    uint64_t question_id;
    uint64_t number;
    std::string title;
    std::string decision;
    std::string context;
    uint64_t votes_for;
    uint64_t votes_against;
    uint64_t votes_abstained;
    bool accepted;
};
