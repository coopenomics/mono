/**
 * Запись `coop_cpp_registry` per-cooperative — связка ЦПП-шаблона из платформенного
 * document registry с расширением controller'а.
 *
 * Story 1.2 (epics.md, Эпик 1) + Locked Decisions L8/L9.
 *
 * Каждое расширение, у которого есть ЦПП-документ для онбординга, кладёт в
 * реестр одну запись с `template_document_registry_id` (из платформенного
 * document registry, см. AR33/Story 1.7) и `required_for_extension`. Stories
 * 1.4/1.9/1.11 читают её, чтобы знать, какой template подписан/подписывается.
 *
 * `mvp_hardcoded: true` — индикатор fallback'а FR43a (захардкоженная пара
 * template'ов, без UI конструктора ЦПП в admin-столе MVP). После Phase 2
 * (динамический конструктор ЦПП в core) этот флаг переключится в `false`.
 */
export class CppRegistryEntryDomainEntity {
  public template_document_registry_id!: number;
  public required_for_extension!: string;
  public mvp_hardcoded!: boolean;
  public created_at?: Date;
  public updated_at?: Date;

  constructor(props: {
    template_document_registry_id: number;
    required_for_extension: string;
    mvp_hardcoded: boolean;
    created_at?: Date;
    updated_at?: Date;
  }) {
    this.template_document_registry_id = props.template_document_registry_id;
    this.required_for_extension = props.required_for_extension;
    this.mvp_hardcoded = props.mvp_hardcoded;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }
}
