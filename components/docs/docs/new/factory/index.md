---
tags:
  - Председатель
  - Член совета
  - Пайщик
  - Разработчик  
---

Электронные документы в кооперативе — это юридически-значимые действия. Для них важны одинаковая форма, повторяемость и проверяемость. Фабрика автоматизирует процесс и делает его повторяемым: каждый документ создаётся по одному маршруту, на основе шаблона, версии шаблона и исходных данных, которые можно перепроверить. Это защищает от расхождений между версиями, гарантирует, что контрольная сумма и подпись относятся к тому же содержимому, и самое главное - позволяет автоматизировать работу документами в стандартизированных бизнес-процессах кооператива.


## Электронный документ

Электронный документ — файл, который содержит юридически-значимое действие пайщика. Он создан по общему кооперативному стандарту, может быть подписан и передан. 

Электронный документ в кооперативной экономике может находится в двух математически-связанных между собой состояниями: полная форма и подписанная форма. 

Полная форма документа включает в себя "сырые" данные, доступные для отображения или скачивания в виде PDF-файла. Это тот вид документа, который мы привыкли видеть, и который содержит все данные, которые в нем должны быть - все заполненные поля, доступные для чтения, и т.д.. 

Интерфейс данных полного документа: 

{{ get_typedoc_definition("GeneratedDocument") }}

Подписанная форма документа включает в себя контрольную сумму полной формы, следовательно, они математически-взаимосвязаны - из полной формы всегда можно получить контрольную сумму подписанной формы и произвести сверку. В подписанной форме всегда есть контрольная сумма полного документа и мета-данные, которых достаточно для того, чтобы установить того, кто сгенерировал документ, и того, кто его подписал, и сделать это математически-точно и без публичного раскрытия персональных данных. 

Интерфейс данных подписанного документа:

{{ get_typedoc_definition("SignedBlockchainDocument") }}

Обратное же, т.е. получить полную форму из подписанной может только тот, у кого есть доступ к закрытой информации в базе данных кооператива - обычно это или пайщик, кому принадлежит документ, или член совета. 

Для передачи подписей в документах используется следующий интерфейс:

{{ get_typedoc_definition("SignatureInfoInput") }}

Он позволяет накладывать на документ и поверх предыдущих подписей неограниченное количество новых подписей. Обычно, нам в наших бизнес-процессах не требуется больше двух подписей на одном документе (например, на акте приёма-передачи требуется две подписи). Но для исключительных случаев мы не ограничены в количестве подписей на одном документе. 

Проверка подписей осуществляется на уровне смарт-контрактов блокчейна, требуя наличия подписи от конкретного аккаунта-участника бизнес-действия. Кроме этого, проверку подписей документов осуществляет бэкенд программного комплекса цифрового кооператива каждый раз при запросе документов пайщиком или членом совета. 

## Подпись документа

Как мы ранее могли обратить внимание, внизу каждого электронного документа на платформе есть блок подписи, давайте взглянем на него еще раз:

![подпись документа](/assets/new/signature_1.png)

Мы видим контрольную сумму документа, а также блок с указанием количества подписей, где каждая подпись указывает на сертификат подписанта. Сертификаты выдаются пайщикам при регистрации и хранятся в базе данных кооператива. Мы извлекли сертификат пайщика на основании имени аккаунта подписанта, которое мы безопасно хранили в блокчейне. 

Далее мы видим цифровую подпись. Как мы ранее говорили, она накладывается на контрольную сумму документа с помощью приватного ключа пайщика. А поскольку мы обладаем именем аккаунта пайщика, то мы всегда можем извлечь публичный ключ и произвести математическую сверку корректности подписи и ее принадлежности к указанному аккаунту. Что мы и делаем, когда показываем идентификатор статуса подписи - "Верифицирована".


## Глубокая сверка
При необходимости из базы данных кооператива могут быть извлечены исходные данные, которые использовались для генерации полного документа, и использованы для того, чтобы на основании публичных мета-данных произвести глубокую сверку. 

При глубокой сверке фабрика документов произведет полную регенерацию документа из исходных данных, заполнив ими шаблон электронного документа заново, и если все в порядке - то получит тот же самый результат в виде полностью идентичной контрольной суммы документа, который и был подписан. Глубокую сверку документов рекомендуется производить у всех документов пайщиков до принятия решений по ним. 


## Фабрика документов
Итак, что же такое фабрика документов? 

Фабрика документов - это архитектурный паттерн, который позволяет производить одинаковым образом разные документы за счет использования шаблонов и общих стандартов генерации. 

Фабрика предоставляет конвейеры по производству электронных документов, которые работают в целом одинаково: извлекают шаблон документа из блокчейна, подставляют данные пайщиков, формируют полный документ и возвращает его пайщику. Т.е. фабрика отвечает за генерацию и глубокую сверку документов, а также за резервное хранение полных документов и сертификатов пайщиков с их личными данными с полной историей изменений, на основании которых эти полные документы генерировались. 

Таким образом, фабрика способна в любой момент предоставить или полный документ или произвести глубокую сверку документа на основании своих исторических данных. 

Мы не будем в данном разделе подробно останавливаться на принципах генерации документов из шаблов, т.к. это продукт стандартов кооперативной экономики и данный материал будет описан на соответствующих страницах сайта [https://coopenomics.world](https://coopenomics.world). 



## Реестр шаблонов

| id | Название | SDK | GraphQL |
| --- | --- | --- | --- |
| 1 | Согласие с условиями ЦПП «ЦИФРОВОЙ КОШЕЛЕК» | {{ get_sdk_doc("Mutations", "Agreements", "GenerateWalletAgreement") }} | {{ get_graphql_doc("Mutation.generateWalletAgreement") }} |
| 2 | Согласие с условиями положения о простой электронной подписи | {{ get_sdk_doc("Mutations", "Agreements", "GenerateSignatureAgreement") }} | {{ get_graphql_doc("Mutation.generateSignatureAgreement") }} |
| 3 | Согласие с условиями политики обработки конфиденциальных данных | {{ get_sdk_doc("Mutations", "Agreements", "GeneratePrivacyAgreement") }} | {{ get_graphql_doc("Mutation.generatePrivacyAgreement") }} |
| 4 | Согласие с условиями пользовательского соглашения | {{ get_sdk_doc("Mutations", "Agreements", "GenerateUserAgreement") }} | {{ get_graphql_doc("Mutation.generateUserAgreement") }} |
| 50 | Пользовательское соглашение (оферта) о присоединении к платформе "Кооперативная Экономика" | — | — |
| 51 | Заявление о конвертации паевого взноса в членский взнос | {{ get_sdk_doc("Mutations", "Provider", "GenerateConvertToAxonStatement") }} | {{ get_graphql_doc("Mutation.generateConvertToAxonStatement") }} |
| 100 | Заявление на вступление в кооператив | {{ get_sdk_doc("Mutations", "Participants", "GenerateParticipantApplication") }} | {{ get_graphql_doc("Mutation.generateParticipantApplication") }} |
| 101 | Заявление пайщика о выборе кооперативного участка | {{ get_sdk_doc("Mutations", "Branches", "GenerateSelectBranchDocument") }} | {{ get_graphql_doc("Mutation.generateSelectBranchDocument") }} |
| 300 | Предложение повестки дня общего собрания | {{ get_sdk_doc("Mutations", "Meet", "GenerateAnnualGeneralMeetAgendaDocument") }} | {{ get_graphql_doc("Mutation.generateAnnualGeneralMeetAgendaDocument") }} |
| 301 | Решение совета о созыве общего собрания | {{ get_sdk_doc("Mutations", "Meet", "GenerateSovietDecisionOnAnnualMeetDocument") }} | {{ get_graphql_doc("Mutation.generateSovietDecisionOnAnnualMeetDocument") }} |
| 302 | Уведомление о проведении общего собрания | {{ get_sdk_doc("Mutations", "Meet", "GenerateAnnualGeneralMeetNotificationDocument") }} | {{ get_graphql_doc("Mutation.generateAnnualGeneralMeetNotificationDocument") }} |
| 303 | Заявление с бюллетенем для голосования на общем собрании | {{ get_sdk_doc("Mutations", "Meet", "GenerateBallotForAnnualGeneralMeetDocument") }} | {{ get_graphql_doc("Mutation.generateBallotForAnnualGeneralMeetDocument") }} |
| 304 | Протокол решения общего собрания | {{ get_sdk_doc("Mutations", "Meet", "GenerateAnnualGeneralMeetDecisionDocument") }} | {{ get_graphql_doc("Mutation.generateAnnualGeneralMeetDecisionDocument") }} |
| 501 | Решение совета о приёме пайщика в кооператив | {{ get_sdk_doc("Mutations", "Participants", "GenerateParticipantApplicationDecision") }} | {{ get_graphql_doc("Mutation.generateParticipantApplicationDecision") }} |
| 599 | Предложение повестки дня собрания совета | {{ get_sdk_doc("Mutations", "FreeDecisions", "GenerateProjectOfFreeDecision") }} | {{ get_graphql_doc("Mutation.generateProjectOfFreeDecision") }} |
| 600 | Протокола решения совета | {{ get_sdk_doc("Mutations", "FreeDecisions", "GenerateFreeDecision") }} | {{ get_graphql_doc("Mutation.generateFreeDecision") }} |
| 699 | Согласие с условиями ЦПП «СОСЕДИ» | — | — |
| 700 | Заявление на паевый взнос имуществом | {{ get_sdk_doc("Mutations", "Cooplace", "GenerateAssetContributionStatement") }} | {{ get_graphql_doc("Mutation.generateAssetContributionStatement") }} |
| 701 | Протокол решения совета о форме и стоимости имущества | {{ get_sdk_doc("Mutations", "Cooplace", "GenerateAssetContributionDecision") }} | {{ get_graphql_doc("Mutation.generateAssetContributionDecision") }} |
| 702 | Акт приёма-передачи имущества | {{ get_sdk_doc("Mutations", "Cooplace", "GenerateAssetContributionAct") }} | {{ get_graphql_doc("Mutation.generateAssetContributionAct") }} |
| 800 | Заявление на возврат паевого взноса имуществом | {{ get_sdk_doc("Mutations", "Cooplace", "GenerateReturnByAssetStatement") }} | {{ get_graphql_doc("Mutation.generateReturnByAssetStatement") }} |
| 801 | Протокол решения совета о возврате паевого взноса имуществом по соглашению новации | {{ get_sdk_doc("Mutations", "Cooplace", "GenerateReturnByAssetDecision") }} | {{ get_graphql_doc("Mutation.generateReturnByAssetDecision") }} |
| 802 | Акт приёмки-передачи имущества | {{ get_sdk_doc("Mutations", "Cooplace", "GenerateReturnByAssetAct") }} | {{ get_graphql_doc("Mutation.generateReturnByAssetAct") }} |
| 900 | Заявление на возврат паевого взноса денежными средствами | {{ get_sdk_doc("Mutations", "Wallet", "GenerateReturnByMoneyStatementDocument") }} | {{ get_graphql_doc("Mutation.generateReturnByMoneyStatementDocument") }} |
| 901 | Решение совета о возврате паевого взноса | {{ get_sdk_doc("Mutations", "Wallet", "GenerateReturnByMoneyDecisionDocument") }} | {{ get_graphql_doc("Mutation.generateReturnByMoneyDecisionDocument") }} |
| 1000 | Оферта по капитализации | {{ get_sdk_doc("Mutations", "Capital", "GenerateCapitalizationAgreement") }} | {{ get_graphql_doc("Mutation.capitalGenerateCapitalizationAgreement") }} |
| 1001 | Договор участия в хозяйственной деятельности | {{ get_sdk_doc("Mutations", "Capital", "GenerateGenerationContract") }} | {{ get_graphql_doc("Mutation.capitalGenerateGenerationContract") }} |
| 1002 | Приложение к договору участия | <!-- SDK: Capital.GenerateAppendixGenerationContract (не реализован) --> | {{ get_graphql_doc("Mutation.capitalGenerateAppendixGenerationContract") }} |
| 1010 | Заявление о расходах | {{ get_sdk_doc("Mutations", "Capital", "GenerateExpenseStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateExpenseStatement") }} |
| 1011 | Решение совета о расходах | {{ get_sdk_doc("Mutations", "Capital", "GenerateExpenseDecision") }} | {{ get_graphql_doc("Mutation.capitalGenerateExpenseDecision") }} |
| 1020 | Заявление об инвестировании денежных средств в генерацию | {{ get_sdk_doc("Mutations", "Capital", "GenerateGenerationMoneyInvestStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateGenerationMoneyInvestStatement") }} |
| 1025 | Заявление о возврате неиспользованных средств генерации | <!-- SDK: Capital.GenerateGenerationMoneyReturnUnusedStatement (не реализован) --> | {{ get_graphql_doc("Mutation.capitalGenerateGenerationMoneyReturnUnusedStatement") }} |
| 1030 | Заявление об инвестировании средств в капитализацию | {{ get_sdk_doc("Mutations", "Capital", "GenerateCapitalizationMoneyInvestStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateCapitalizationMoneyInvestStatement") }} |
| 1040 | Заявление на внесение результата интеллектуальной деятельности | {{ get_sdk_doc("Mutations", "Capital", "GenerateResultContributionStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateResultContributionStatement") }} |
| 1041 | Решение совета об инвестициях по результатам | {{ get_sdk_doc("Mutations", "Capital", "GenerateResultContributionDecision") }} | {{ get_graphql_doc("Mutation.capitalGenerateResultContributionDecision") }} |
| 1042 | Акт приема-передачи результата интеллектуальной деятельности | {{ get_sdk_doc("Mutations", "Capital", "GenerateResultContributionAct") }} | {{ get_graphql_doc("Mutation.capitalGenerateResultContributionAct") }} |
| 1050 | Заявление на получение займа | {{ get_sdk_doc("Mutations", "Capital", "GenerateGetLoanStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateGetLoanStatement") }} |
| 1051 | Решение совета о предоставлении займа | {{ get_sdk_doc("Mutations", "Capital", "GenerateGetLoanDecision") }} | {{ get_graphql_doc("Mutation.capitalGenerateGetLoanDecision") }} |
| 1060 | Заявление об инвестировании имущества в генерацию | {{ get_sdk_doc("Mutations", "Capital", "GenerateGenerationPropertyInvestStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateGenerationPropertyInvestStatement") }} |
| 1061 | Решение совета об инвестировании имущества в генерацию | {{ get_sdk_doc("Mutations", "Capital", "GenerateGenerationPropertyInvestDecision") }} | {{ get_graphql_doc("Mutation.capitalGenerateGenerationPropertyInvestDecision") }} |
| 1062 | Акт приема-передачи имущества в генерацию | {{ get_sdk_doc("Mutations", "Capital", "GenerateGenerationPropertyInvestAct") }} | {{ get_graphql_doc("Mutation.capitalGenerateGenerationPropertyInvestAct") }} |
| 1070 | Заявление об инвестировании имущества в капитализацию | {{ get_sdk_doc("Mutations", "Capital", "GenerateCapitalizationPropertyInvestStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateCapitalizationPropertyInvestStatement") }} |
| 1071 | Решение совета об инвестировании имущества в капитализацию | {{ get_sdk_doc("Mutations", "Capital", "GenerateCapitalizationPropertyInvestDecision") }} | {{ get_graphql_doc("Mutation.capitalGenerateCapitalizationPropertyInvestDecision") }} |
| 1072 | Акт приема-передачи имущества в капитализацию | {{ get_sdk_doc("Mutations", "Capital", "GenerateCapitalizationPropertyInvestAct") }} | {{ get_graphql_doc("Mutation.capitalGenerateCapitalizationPropertyInvestAct") }} |
| 1080 | Заявление о конвертации средств генерации в основной кошелек | {{ get_sdk_doc("Mutations", "Capital", "GenerateGenerationToMainWalletConvertStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateGenerationToMainWalletConvertStatement") }} |
| 1081 | Заявление о конвертации средств генерации в проект | {{ get_sdk_doc("Mutations", "Capital", "GenerateGenerationToProjectConvertStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateGenerationToProjectConvertStatement") }} |
| 1082 | Заявление о конвертации средств генерации в капитализацию | {{ get_sdk_doc("Mutations", "Capital", "GenerateGenerationToCapitalizationConvertStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateGenerationToCapitalizationConvertStatement") }} |
| 1090 | Заявление о конвертации средств капитализации в основной кошелек | {{ get_sdk_doc("Mutations", "Capital", "GenerateCapitalizationToMainWalletConvertStatement") }} | {{ get_graphql_doc("Mutation.capitalGenerateCapitalizationToMainWalletConvertStatement") }} |


## Для разработчиков

### Генерация и подпись
Для того, чтобы сгенерировать документ, необходимо передать ему набор обязательных параметров из интерфейса IInput. Обязательные параметры являются частью процесса генерации документа, а не обязательные параметры обычно являются мета-данными документа. 

Т.е. в результате генерации документа будет получен объект мета-данных, который можно использовать для глубокой сверки, передав их в качестве опциональных параметров. 

{{ get_typedoc_input("Mutations.Participants.GenerateParticipantApplication") }}

<details>
<summary>Результат</summary>
{{ get_typedoc_definition("Mutations.Participants.GenerateParticipantApplication", "IOutput") }}
</details>

Используем полученный документ в `result` для создания подписи:

```typescript
import { Mutations, Classes } from '@coopenomics/sdk'

// 2. Подписываем документ с помощью SDK-класса Document
const signer = new Classes.Document('WIF_PRIVATE_KEY')
const signed = await signer.signDocument(document, 'user1', 1) //1 - это порядковый номер подписи

```
<details>
<summary>Результат</summary>
{{ get_typedoc_definition("SignedBlockchainDocument") }}
</details>

Полученный `signed` документ может быть использован для отправки в мутацией согласно бизнес-процессам, которые мы далее рассматриваем по документации.  

!!!warning "Важно"
    Приватный ключ (WIF) должен соответствовать имени пользователя (username), иначе процесс валидации подписи не будет завершен с успехом.


### Мультиподпись

Когда необходимо создать дополнительную подпись на документе, то мы это делаем на основе подписанного документа, который уже опубликован в блокчейне. Мы берем его, и создаем еще одну подпись, накладывая её поверх ранее подписанного другим пайщиком документа, указывая порядковый номер подписи следующим. 

```typescript
const signed = await signer.signDocument(document, 'user2', 2) 
```

    