import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1001

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  contributor_contract_number: string
}

export const title = 'Договор участия в хозяйственной деятельности'
export const description = 'Форма договора участия в хозяйственной деятельности'

export const context = `<div class="digital-document"><div style="text-align: right; margin-bottom: 20px;"><p style="margin: 0px !important">{% trans 'approved_by_council_meeting' %}</p><p style="margin: 0px !important">{% trans 'council_meeting' %}</p><p style="margin: 0px !important">{{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p style="margin: 0px !important">{% trans 'protocol' %} {{ vars.generation_contract_template.protocol_number }} {% trans 'from_date' %} {{ vars.generation_contract_template.protocol_day_month_year }}</p></div><div style="text-align: center; margin-bottom: 20px;"><h1>{% trans 'generation_contract_title' %}</h1><p>{% trans 'agreement_subtitle', contributor_contract_number %}</p></div><p>{{coop.city}}</p><p style="text-align: right">{{ meta.created_at }}</p><p>{{ vars.full_abbr }} {% trans 'in_face_of_chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}, {% trans 'acting_on_basis_of_charter' %}, {% trans 'hereinafter_referred_to_as' %} "{% trans 'society' %}", {% trans 'and_participant' %} {{ user.full_name_or_short_name }}, {% trans 'hereinafter_referred_to_as' %} "{% trans 'participant' %}", {% trans 'jointly_referred_to_as' %} "{% trans 'parties' %}", {% trans 'have_concluded_this_agreement' %} {% trans 'hereinafter_referred_to_as' %} "{% trans 'agreement' %}" {% trans 'of_the_following' %}:</p><h2>1. {% trans 'terms_and_definitions' %}</h2><p><strong>1.1. {% trans 'monetary_funds' %}</strong> - {% trans 'rubles_of_russian_federation' %}.</p><p><strong>1.2. {% trans 'property' %}</strong> - {% trans 'property_definition' %}</p><p><strong>1.3. {% trans 'membership_fee' %}</strong> - {% trans 'membership_fee_definition' %}</p><p><strong>1.4. {% trans 'share_contribution' %}</strong> - {% trans 'share_contribution_definition' %}</p><p><strong>1.5. {% trans 'funds' %}</strong> - {% trans 'funds_definition' %}</p><p><strong>1.6. {% trans 'platform' %}</strong> - {% trans 'platform_definition' %}</p><p><strong>1.7. {% trans 'digital_wallet' %}</strong> - {% trans 'digital_wallet_definition' %}</p><p><strong>1.8. {% trans 'personal_account' %}</strong> - {% trans 'personal_account_definition' %}</p><p><strong>1.9. {% trans 'personal_account_ledger' %}</strong> - {% trans 'personal_account_ledger_definition' %}</p><h2>2. {% trans 'subject_of_agreement' %}</h2><p><strong>2.1.</strong> {% trans 'parties_carry_out' %} {{ coop.short_name }} {% trans 'economic_activity_definition' %}</p><p><strong>2.2.</strong> {% trans 'participant_participates' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}" {% trans 'participant_participates_definition' %}</p><h2>3. {% trans 'procedure_for_acceptance_and_transfer_of_property' %}</h2><p><strong>3.1.</strong> {% trans 'participant_has_right' %}</p><p><strong>3.2.</strong> {% trans 'share_contribution_transfer_monetary', contributor_contract_number %}</p><p><strong>3.3.</strong> {% trans 'share_contribution_transfer_property' %}</p><p><strong>3.4.</strong> {% trans 'council_rights_to_decide' %}</p><p><strong>3.5.</strong> {% trans 'council_considers_application' %}</p><p><strong>3.6.</strong> {% trans 'upon_council_decision' %}</p><p><strong>3.7.</strong> {% trans 'formation_of_membership_fee' %}</p><p><strong>3.8.</strong> {% trans 'storage_agreement' %}</p><p><strong>3.9.</strong> {% trans 'interest_free_loan_right' %}</p><h2>4. {% trans 'procedure_and_conditions_for_return_of_share_contributions' %}</h2><p><strong>4.1.</strong> {% trans 'participant_unconditional_right' %}</p><p><strong>4.2.</strong> {% trans 'return_request_procedure' %}</p><p><strong>4.3.</strong> {% trans 'return_according_to_civil_code' %}</p><p><strong>4.4.</strong> {% trans 'return_through_digital_wallet', contributor_contract_number %}</p><p><strong>4.5.</strong> {% trans 'exit_or_exclusion_return' %}</p><h2>5. {% trans 'rights_and_obligations_of_parties' %}</h2><p><strong>5.1.</strong> {% trans 'participant_has_right_to' %}:</p><ul><li><strong>5.1.1.</strong> {% trans 'right_unlimited_contribution' %}</li><li><strong>5.1.2.</strong> {% trans 'right_offer_any_property' %}</li><li><strong>5.1.3.</strong> {% trans 'right_return_contributions' %}</li><li><strong>5.1.4.</strong> {% trans 'right_receive_material_assistance' %}</li></ul><p><strong>5.2.</strong> {% trans 'participant_obliged_to' %}:</p><ul><li><strong>5.2.1.</strong> {% trans 'obligation_comply_with_agreement' %}</li><li><strong>5.2.2.</strong> {% trans 'obligation_return_loans' %}</li><li><strong>5.2.3.</strong> {% trans 'obligation_confidentiality' %}</li></ul><p><strong>5.3.</strong> {% trans 'society_obliged_to' %}:</p><ul><li><strong>5.3.1.</strong> {% trans 'society_obligation_comply' %}</li><li><strong>5.3.2.</strong> {% trans 'society_obligation_return_contributions' %}</li><li><strong>5.3.3.</strong> {% trans 'society_obligation_return_liquidation' %}</li></ul><p><strong>5.4.</strong> {% trans 'society_has_right_to' %}:</p><ul><li><strong>5.4.1.</strong> {% trans 'society_right_reject_property' %}</li><li><strong>5.4.2.</strong> {% trans 'society_right_return_property' %}</li></ul><h2>6. {% trans 'confidentiality' %}</h2><p><strong>6.1.</strong> {% trans 'parties_obliged_confidentiality' %}</p><p><strong>6.2.</strong> {% trans 'confidential_information_definition' %}</p><p><strong>6.3.</strong> {% trans 'confidential_information_content' %}</p><p><strong>6.4.</strong> {% trans 'disclosure_of_confidential_information' %}</p><p><strong>6.5.</strong> {% trans 'confidentiality_not_applies' %}</p><p><strong>6.6.</strong> {% trans 'receiving_party_obliged' %}</p><p><strong>6.7.</strong> {% trans 'upon_compulsion_notification' %}</p><p><strong>6.8.</strong> {% trans 'no_intellectual_property_rights' %}</p><p><strong>6.9.</strong> {% trans 'materials_remain_property' %}</p><h2>7. {% trans 'force_majeure_circumstances' %}</h2><p><strong>7.1.</strong> {% trans 'legislation_changes_society_right' %}</p><p><strong>7.2.</strong> {% trans 'legislation_changes_considered_force_majeure' %}</p><p><strong>7.3.</strong> {% trans 'force_majeure_cases_list' %}</p><p><strong>7.4.</strong> {% trans 'force_majeure_notification' %}</p><h2>8. {% trans 'final_provisions' %}</h2><p><strong>8.1.</strong> {% trans 'agreement_two_copies' %}</p><p><strong>8.2.</strong> {% trans 'agreement_governed_by_laws' %}</p><p><strong>8.3.</strong> {% trans 'invalid_provisions' %}</p><p><strong>8.4.</strong> {% trans 'agreement_enters_into_force' %}</p><p><strong>8.5.</strong> {% trans 'changes_and_amendments' %}</p><p><strong>8.6.</strong> {% trans 'appendices_integral_part' %}</p><p><strong>8.7.</strong> {% trans 'interaction_remotely' %} https://{{vars.website}}.</p><p><strong>8.8.</strong> {% trans 'upon_exit_agreement_terminates' %}</p><p><strong>8.9.</strong> {% trans 'disputes_resolved_by_negotiation' %}</p><h2>9. {% trans 'details_and_signatures_of_parties' %}</h2><p><strong>{% trans 'society' %}/{{ vars.full_abbr }} "{{ vars.name }}"/:</strong></p><p>ИНН {{ coop.details.inn }}, КПП {{ coop.details.kpp }}, ОГРН {{ coop.details.ogrn }}</p><p>{% trans 'legal_address' %}: {{ coop.full_address }}</p><p>{% trans 'contact_phone' %}: {{ coop.phone }}</p><p>{% trans 'email' %}: {{ coop.email }}</p><p>{% trans 'bank_account' %} {{ coop.defaultBankAccount.account_number }} {% trans 'in_bank' %} {{ coop.defaultBankAccount.bank_name }} {% trans 'bik' %} {{ coop.defaultBankAccount.details.bik }} {% trans 'correspondent_account' %}: {{ coop.defaultBankAccount.details.corr }}</p><p>{% trans 'chairman' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p>{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signed_by_digital_signature' %}</p><p><strong>{% trans 'participant' %}:</strong></p><p>{{ user.full_name_or_short_name }}</p><p>{% trans 'contact_phone' %}: {{ user.phone }}</p><p>{% trans 'email' %}: {{ user.email }}</p><p>{% trans 'signed_by_digital_signature' %}</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}</style>`

export const translations = {
  ru: {
    approved_by_council_meeting: 'Утвержден',
    council_meeting: 'заседанием Совета',
    protocol: 'Протокол №',
    from_date: 'от',
    generation_contract_title: 'ДОГОВОР',
    agreement_subtitle: 'об участии в хозяйственной деятельности № {0}',
    in_face_of_chairman: 'в лице Председателя Совета',
    acting_on_basis_of_charter: 'действующего на основании Устава',
    hereinafter_referred_to_as: 'далее именуемый(-ая)',
    society: 'Общество',
    and_participant: 'и',
    participant: 'Пайщик',
    jointly_referred_to_as: 'совместно именуемые',
    parties: 'Стороны',
    have_concluded_this_agreement: 'заключили настоящий Договор',
    agreement: 'Договор',
    of_the_following: 'о нижеследующем',
    terms_and_definitions: 'ТЕРМИНЫ И ОПРЕДЕЛЕНИЯ',
    monetary_funds: 'Денежные Средства',
    rubles_of_russian_federation: 'Рубли Российской Федерации',
    property: 'Имущество',
    property_definition: 'предметы, вещи и материальные объекты, денежные средства, а также овеществленные (на бумажных и цифровых носителях) и выраженные в денежной оценке объекты авторских прав и другие результаты интеллектуальной деятельности пайщиков, а именно: полит-экономические, социологические, технологические, методологические, юридические и пр. разработки, инновации, решения, методы, способы и подходы, программное обеспечение и его элементы, а также, выраженные в денежной оценке, подтвержденные материальные и ресурсные затраты Вкладчика (творческие, физические, финансовые и временные), деривативы денежных средств, акции и доли предприятий, имущественные права, цифровые имущественные права, цифровые финансовые и информационные активы, права на нематериальные активы, интеллектуальная собственность и прочее.',
    membership_fee: 'Членский взнос',
    membership_fee_definition: 'невозвратный целевой взнос Пайщика в Общество денежными средствами или Имуществом, в размере и на условиях по согласованию с Обществом;',
    share_contribution: 'Паевой взнос',
    share_contribution_definition: 'безусловно возвратный взнос в паевой фонд Общества Денежными средствами и/или иным Имуществом в соответствии с условиями настоящего Договора.',
    funds: 'Фонды',
    funds_definition: 'Имущество Общества, предназначенное для использования на содержание и уставной деятельности Общества в соответствии с целями, утвержденными общим собранием пайщиков.',
    platform: 'Платформа',
    platform_definition: 'информационная экосистема, интегрируемая в социально-экономическую среду Российской Федерации, состоящая из комплекса программных продуктов на базе технологии распределенного реестра, обеспечивающих широкое экономическое и социальное взаимодействие физических и юридических лиц, включая нерезидентов различных юрисдикций и организационно-правовых форм, на основе международных кооперативных принципов и законодательства Российской Федерации в отношении потребительских кооперативов (обществ) под названием "Кооперативная Экономика".',
    digital_wallet: 'Цифровой кошелек (ЦК)',
    digital_wallet_definition: 'уникальный счет Пайщика, предоставляемый ему Обществом, в виде записи учета всех денежных поступлений Пайщика в Общество и объединяющий лицевые счета Пайщика по участию в целевых потребительских программах Кооператива, на который Пайщик перечисляет Денежные средства, в том числе, с целью внесения и возврата взносов денежными средствами. Пайщик присоединяется к действию «Положения о целевой потребительской программе «ЦИФРОВОЙ КОШЕЛЕК» акцептуя оферту при вступлении в Общество.',
    personal_account: 'Личный Кабинет (ЛК)',
    personal_account_definition: 'виртуальное пространство Пайщика в информационной системе Общества на сайте https://цифровой-кооператив.рф создаваемый при его вступлении в пайщики Общества и присоединению к целевой потребительской программе "Цифровой Кошелек" и, в котором отображается учет операций по его взаимодействию с Обществом, в том числе и по участию в хозяйственной деятельности Общества в рамках отдельных договоров и целевых потребительских программах Общества.',
    personal_account_ledger: 'Лицевой счет (ЛС)',
    personal_account_ledger_definition: 'уникальный счет Пайщика по учету его операций по взносам и займам, в соответствии с каждым из договоров и целевыми потребительскими программами Общества, в которых участвует Пайщик, указанный в его ЛК.',
    subject_of_agreement: 'ПРЕДМЕТ ДОГОВОРА',
    parties_carry_out: 'Стороны осуществляют хозяйственную деятельность по проектированию, разработке, прототипированию и эксплуатации цифровых информационно-технологических решений и программного обеспечения, направленного на создание и развитие',
    economic_activity_definition: 'Платформы.',
    participant_participates: 'Пайщик участвует в хозяйственной деятельности',
    participant_participates_definition: 'путем внесения целевых паевых взносов в паевой фонд Общества Имуществом и Денежными Средствами, в рамках исполнения Предмета настоящего Договора в соответствии с п.2.1. и Приложениями к настоящему Договору, являющимися его неотъемлемой частью.',
    procedure_for_acceptance_and_transfer_of_property: 'ПОРЯДОК ПРИЕМА-ПЕРЕДАЧИ ИМУЩЕСТВА',
    participant_has_right: 'Пайщик имеет право внесения Паевого взноса в паевой фонд Общества Имуществом или Денежными Средствами в рамках Предмета настоящего Договора.',
    share_contribution_transfer_monetary: 'Внесение Паевого взноса в Складочный капитал ЦПП Денежными Средствами производится по заявлению Пайщика в Совет Общества списанием с ЦК Пайщика на его ЛС по настоящему Договору и/или его приложений с указанием назначения платежа «Паевой целевой взнос в соответствии с Договором об участии в хозяйственной деятельности № {0}».',
    share_contribution_transfer_property: 'Внесение Пайщиком Паевого взноса Имуществом производится по заявлению Пайщика в Совет Общества, в котором Пайщик указывает основание - номер и дату настоящего Договора УХД, предоставляет название и описание Имущества, его характеристики, условия эксплуатации, а также выраженную в денежной оценке предложенную стоимость. Заявление оформляется в формате, установленным Обществом.',
    council_rights_to_decide: 'Совет Общества вправе отложить принятие от Пайщика Имущества в качестве Паевого взноса или принять его сразу, целиком или частично, или отказать в принятии Имущества в качестве Паевого взноса целиком или частично.',
    council_considers_application: 'Совет Общества рассматривает заявление Пайщика о принятии Имущества в качестве Паевого взноса в срок до 15 (Пятнадцати) календарных дней.',
    upon_council_decision: 'При решении Совета Общества принять Имущество Пайщика в качестве Паевого взноса, Стороны составляют и подписывают Акт приема-передачи Имущества, в котором фиксируется характеристики Имущества и его стоимость, как размер Паевого взноса в денежном выражении, а на ЛС по настоящему Договору отражается такая стоимость Паевого взноса Пайщика.',
    formation_of_membership_fee: 'По согласованию Сторон, из части Паевого взноса, может формироваться Членский взнос Пайщика, который направляется в Фонды Общества для покрытия затрат Общества в соответствии с утвержденными целями их использования.',
    storage_agreement: 'Общество вправе принять от Пайщика Имущество на ответственное хранение, условия которого формулируется дополнительными условиями, являющимися приложением к настоящему Договору.',
    interest_free_loan_right: 'При передаче Имущества на ответственное хранение в Общество в соответствии с п. 3.8. настоящего Договора, Пайщик, в соответствии с Положением Общества о предоставлении займов пайщикам, имеет право на получение беспроцентного займа в размерах и на условиях, определенных приложениями к настоящему Договору.',
    procedure_and_conditions_for_return_of_share_contributions: 'ПОРЯДОК И УСЛОВИЯ ВОЗВРАТА ПАЕВЫХ ВЗНОСОВ',
    participant_unconditional_right: 'Пайщик, после принятия Имущества в качестве Паевого взноса в Общество, имеет безусловное право получить возврат своего Паевого взноса, как целиком (при выходе из состава пайщиков Общества), так и частично в соответствии с индивидуальными условиями, зафиксированными в приложениях к настоящему Договору.',
    return_request_procedure: 'Для возврата Паевого взноса или его части, согласованного Сторонами в приложениях к настоящему Договору, Пайщик направляет заявление в Совет Общества, которое рассматривается в течение 5 (пяти) рабочих дней.',
    return_according_to_civil_code: 'Возврат Паевого взноса или его части Пайщику в соответствии с условиями, согласованными Сторонами в приложениях к настоящему Договору, осуществляется в соответствии с Главой 26 ГК РФ, что предполагает в том числе соглашения зачета и/или новации между Пайщиком и Обществом.',
    return_through_digital_wallet: 'Возврат Паевого взноса Пайщику по результатам участия в хозяйственной деятельности Общества в рамках настоящего Договора производится через начисление на ЦК Пайщика с указанием назначения платежа «Возврат Паевого взноса в соответствии с Договором об участии в хозяйственной деятельности № {0}».',
    exit_or_exclusion_return: 'В случае, если Пайщик выходит или исключен из состава пайщиков Общества, возврат Паевого взноса Пайщику производится Имуществом или Денежными средствами, по согласованию с Обществом, равной стоимости остатка паевых взносов на ЛС Пайщика по настоящему Договору, а также совокупного баланса на ЦК Пайщика. Заявление Пайщика о возврате Паевого взноса в полном размере рассматривается Советом Общества в течение 30 (тридцати) календарных дней. Паевой взнос возвращается в соответствии с Уставом Общества (ст. 10.3.) в течение 330 (трехсот тридцати) дней после принятия решения Советом Общества о возврате Паевого взноса Пайщику, на реквизиты, указанные Пайщиком в заявлении на возврат Паевого взноса.',
    rights_and_obligations_of_parties: 'ПРАВА И ОБЯЗАННОСТИ СТОРОН',
    participant_has_right_to: 'Пайщик имеет право',
    right_unlimited_contribution: 'вносить Паевой взнос Имуществом и\\или Денежными Средствами в неограниченном размере и неограниченное количество раз;',
    right_offer_any_property: 'предлагать к внесению в Паевой взнос Имущество любого вида;',
    right_return_contributions: 'осуществлять возврат паевого/ых взносов в соответствии с условиями настоящего Договора;',
    right_receive_material_assistance: 'получать материальную помощь в форме беспроцентных займов и безвозвратной помощи.',
    participant_obliged_to: 'Пайщик обязан',
    obligation_comply_with_agreement: 'соблюдать условия настоящего Договора;',
    obligation_return_loans: 'возвращать выданные Обществом займы в сроки и объемах, соответствующие заявлениям и решениям Совета Общества, в том числе и через зачет полученных от Общества займов в стоимости своих паевых взносов в Общество по условиям настоящего Договора и его приложений.',
    obligation_confidentiality: 'соблюдать условия конфиденциальности и неразглашения в соответствии с параграфом 6 настоящего Договора.',
    society_obliged_to: 'Общество обязано',
    society_obligation_comply: 'соблюдать условия настоящего Договора и права Пайщика, в соответствии с настоящим Договором, другими документами Общества и действующим законодательством РФ;',
    society_obligation_return_contributions: 'возвращать Пайщику его Паевой взнос в соответствии с условиями настоящего Договора и приложений к нему;',
    society_obligation_return_liquidation: 'возвратить Пайщику внесенные Паевые взносы в случае прекращения деятельности Общества или его ликвидации.',
    society_has_right_to: 'Общество имеет право',
    society_right_reject_property: 'не принять Имущество, предложенное Пайщиком в качестве Паевого взноса для целей и в рамках настоящего Договора;',
    society_right_return_property: 'вернуть Имущество Пайщика, принятое Обществом на рассмотрение к принятию в качестве Паевого взноса в рамках настоящего Договора без каких-либо обязательств Общества.',
    confidentiality: 'КОНФИДЕНЦИАЛЬНОСТЬ',
    parties_obliged_confidentiality: 'Стороны настоящего Договора обязаны соблюдать условия конфиденциальности и неразглашения в отношении Предмета настоящего Договора, Имущества Общества, а также технологических, методологических и организационных аспектов Платформы в течение действия настоящего Договора, а также в течение 5 (пяти) лет с даты прекращения действия настоящего Договора.',
    confidential_information_definition: 'Конфиденциальная информация, в соответствии с Федеральным законом от 29 июля 2004 г. №98-ФЗ «О коммерческой тайне», это информация, составляющая коммерческую тайну (секрет производства), сведения любого характера (производственные, технические, экономические, организационные и другие), в том числе о результатах интеллектуальной деятельности в научно-технической сфере, а также сведения о способах осуществления профессиональной деятельности, которые имеют действительную или потенциальную коммерческую ценность в силу неизвестности их третьим лицам, к которым у третьих лиц нет свободного доступа на законном основании и в отношении которых обладателем таких сведений введен режим коммерческой тайны.',
    confidential_information_content: 'В рамках настоящего Договора под Конфиденциальной информацией подразумевается настоящая или будущая информация, относящаяся к Предмету настоящего Договора - Платформе - или техническим возможностям Раскрывающей стороны или аффилированных лиц в рамках настоящего Договора, изделиям, услугам, фактическим и аналитическим данным, заключениям и материалам, включая заметки, документацию, переписку, а также любую информацию, полученную Принимающей стороной о или от Раскрывающей стороны в ходе исполнения условий настоящего Договора.',
    disclosure_of_confidential_information: 'Разглашение конфиденциальной информации - действие или бездействие, в результате которых информация, составляющая коммерческую тайну, в любой возможной форме (устной, письменной, иной форме, в том числе с использованием технических средств) становится известной третьим лицам без согласия обладателя такой информации либо вопреки условиям настоящего Договора.',
    confidentiality_not_applies: 'Конфиденциальной информацией не является информация, уже являющаяся или ставшая общеизвестной законным путем, не по вине Принимающей стороны или ее аффилированных лиц.',
    receiving_party_obliged: 'Принимающая сторона обязуется не раскрывать и не передавать третьим лицам любую Конфиденциальную информацию, полученную от Раскрывающей стороны или ставшую известной в ходе какой-либо совместной деятельности с Раскрывающей стороной, за исключением случаев, когда того требует Законодательство.',
    upon_compulsion_notification: 'В случае передачи Конфиденциальной информации в органы или учреждения государственной власти по принуждению, Принимающая сторона обязуется ограничить эту передачу требуемым минимумом и незамедлительно уведомить Раскрывающую сторону о сути этой передачи в той максимальной степени, в какой это может быть допустимо в свете обстоятельств.',
    no_intellectual_property_rights: 'Факт предоставления Принимающей стороне доступа к Конфиденциальной информации не означает предоставления ему каких-либо прав интеллектуальной собственности и (или) лицензий в отношении Конфиденциальной информации. Настоящий Договор о неразглашении Конфиденциальной информации не предусматривает право на изготовление, заказа на изготовление, использование или продажу Конфиденциальной информации.',
    materials_remain_property: 'Все материальные носители, на которых записана Конфиденциальная информация, представленные Принимающей стороне в соответствии с настоящим Договором, а также любые снятые с них копии, являются собственностью Раскрывающей стороны, и подлежат возврату и/или уничтожению Принимающей стороной в соответствии с указаниями Раскрывающей стороны. Раскрывающая сторона сохраняет право дать Принимающей стороне указание об удалении Конфиденциальной информации с принадлежащих Принимающей стороне материальных носителей, или об уничтожении данных материальных носителей, если удаление с них Конфиденциальной информации невозможно.',
    force_majeure_circumstances: 'ФОРС МАЖОРНЫЕ ОБСТОЯТЕЛЬСТВА',
    legislation_changes_society_right: 'В случае вступления в силу таких изменений в законодательство РФ, которые повлекут за собой несоответствие им условий настоящего Договора, Общество может внести в настоящий Договор такие изменения, при которых условия настоящего Договора будут соответствовать действующему на территории РФ законодательству.',
    legislation_changes_considered_force_majeure: 'Изменения законодательства РФ, которые повлекут за собой несоответствие им условий настоящего Договора, считаются форс-мажорными обстоятельствами для Общества.',
    force_majeure_cases_list: 'Форс-мажорными являются также все случае которые являются форс мажорными при гражданском обороте в том числе: повреждение, порча имущества, в т. ч. созданное и приобретенное Обществом в рамках настоящего Договора, через пожар, затопление, кражу, гражданские конфликты, военные действия, комендантский час, объявленный карантин, стихийные бедствия и др.',
    force_majeure_notification: 'При наступлении форс-мажорных случаев Общество уведомляет о них Пайщика в срок не более двух календарных недель.',
    final_provisions: 'ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ',
    agreement_two_copies: 'Настоящий Договор подписан в двух экземплярах, имеющих равную юридическую силу - по одному для каждой из Сторон.',
    agreement_governed_by_laws: 'Настоящий Договор и его приложения трактуются и регулируются в соответствии с законами Российской Федерации, Уставом и Положениями Общества.',
    invalid_provisions: 'Если какое-либо положение Договора окажется недействительным (ничтожным) или незаконным по действующему законодательству, все остальные положения Договора останутся в силе, как если бы такое положение было отделено от Договора и не входило в него.',
    agreement_enters_into_force: 'Настоящий Договор вступает в силу с момента его утверждения Советом Общества после подписания Сторонами и действует бессрочно.',
    changes_and_amendments: 'Все изменения и дополнения к настоящему Договору действительны только в случае их подписания обеими Сторонами и утверждения Советом Общества.',
    appendices_integral_part: 'Все приложения к настоящему Договору являются его неотъемлемыми частями и действительны только в случае их подписания обеими Сторонами настоящего Договора.',
    interaction_remotely: 'Взаимодействие Пайщика и Общества в рамках настоящего Договора, могут проводиться дистанционно в электронном виде, в том числе и через ЛК Пайщика в информационной системе Общества на сайте',
    upon_exit_agreement_terminates: 'При выходе или исключении Пайщика из Общества настоящий Договор и все его Приложения автоматически теряют силу, за исключением условий, изложенных в п.5.2.2. настоящего Договора.',
    disputes_resolved_by_negotiation: 'Все разногласия стороны решают путем переговоров.',
    details_and_signatures_of_parties: 'РЕКВИЗИТЫ И ПОДПИСИ СТОРОН',
    legal_address: 'Юр. адрес',
    contact_phone: 'Контактный тел.',
    email: 'Электронная почта',
    bank_account: 'Р/с',
    bank_name: 'Банк',
    bik: 'БИК',
    correspondent_account: 'Корр/счет',
    in_bank: 'в',
    chairman: 'Председатель Совета',
    signed_by_digital_signature: 'Подписано электронной подписью',
  },
}

export const exampleData = {
  meta: {
    created_at: '11.04.2024 12:00:00',
  },
  contributor_contract_number: 'ed3bcfd5b681aa83d',
  vars: {
    generation_contract_template: {
      protocol_number: 'СС-11-04-24',
      protocol_day_month_year: '11 апреля 2024 г.',
    },
    name: 'ВОСХОД',
    full_abbr: 'Потребительский Кооператив',
    full_abbr_genitive: 'Потребительского Кооператива',
    website: 'https://цифровой-кооператив.рф',
  },
  user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
    abbr_full_name: 'Иванов И.И.',
    email: 'ivanov@example.com',
    phone: '+7 999 123-45-67',
  },
  coop: {
    short_name: 'ПК "ВОСХОД"',
    details: {
      inn: '9728130611',
      kpp: '772801001',
      ogrn: '1247700283346',
    },
    full_address: '117593, г. МОСКВА, ВН.ТЕР.Г. МУНИЦИПАЛЬНЫЙ ОКРУГ ЯСЕНЕВО, ПРОЕЗД СОЛОВЬИНЫЙ, Д. 1, ПОМЕЩ. 1/1',
    phone: '+7 900 000 0000',
    email: 'info@mycoop.ru',
    defaultBankAccount: {
      currency: 'RUB',
      bank_name: 'ПАО Сбербанк',
      account_number: '40703810038000110117',
      details: {
        bik: '044525225',
        corr: '30101810400000000225',
      },
    },
    chairman: {
      first_name: 'Алексей',
      last_name: 'Муравьев',
      middle_name: 'Николаевич',
    },
    city: 'Москва',
  },
}
