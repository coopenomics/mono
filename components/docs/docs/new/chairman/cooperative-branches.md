---
tags:
  - Председатель
  - Разработчик
---

# Кооперативные участки

Страница ведёт кооперативные участки с их председателями. Участок создаётся за пределами платформы, здесь председатель вносит уже оформленный участок.

![Кооперативные участки](/assets/new/chairman/cooperative-branches/01-page.png)

Строка участка показывает название и председателя участка. Кнопка «Добавить участок» в шапке заводит новый: наименование, адрес, контакты и председатель из числа пайщиков. С трёх участков кооператив переходит на мажоритарную систему управления: действующим пайщикам предлагается выбрать участок и делегировать голос его председателю, новые пайщики выбирают участок при регистрации. Учреждение участка собранием пайщиков описано в приложении [«Кооперативный участок»](../ku/index.md).

## Разработчикам

{{ dev_schema_source() }}

### Список кооперативных участков

{{ get_sdk_doc("Queries", "Branches", "GetBranches") }} | {{ get_graphql_doc("query.getBranches") }}

{{ get_typedoc_desc("Queries.Branches.GetBranches") }}

{{ get_typedoc_input("Queries.Branches.GetBranches") }}

Результат:

{{ get_typedoc_definition("Queries.Branches.GetBranches", "IOutput") }}

### Создать участок

{{ get_sdk_doc("Mutations", "Branches", "CreateBranch") }} | {{ get_graphql_doc("Mutation.createBranch") }}

{{ get_typedoc_desc("Mutations.Branches.CreateBranch") }}

{{ get_typedoc_input("Mutations.Branches.CreateBranch") }}

Результат:

{{ get_typedoc_definition("Mutations.Branches.CreateBranch", "IOutput") }}

### Изменить участок

{{ get_sdk_doc("Mutations", "Branches", "EditBranch") }} | {{ get_graphql_doc("Mutation.editBranch") }}

{{ get_typedoc_desc("Mutations.Branches.EditBranch") }}

{{ get_typedoc_input("Mutations.Branches.EditBranch") }}

Результат:

{{ get_typedoc_definition("Mutations.Branches.EditBranch", "IOutput") }}

### Удалить участок

{{ get_sdk_doc("Mutations", "Branches", "DeleteBranch") }} | {{ get_graphql_doc("Mutation.deleteBranch") }}

{{ get_typedoc_desc("Mutations.Branches.DeleteBranch") }}

{{ get_typedoc_input("Mutations.Branches.DeleteBranch") }}

Результат:

{{ get_typedoc_definition("Mutations.Branches.DeleteBranch", "IOutput") }}

### Документ выбора участка пайщиком

{{ get_sdk_doc("Mutations", "Branches", "GenerateSelectBranchDocument") }} | {{ get_graphql_doc("Mutation.generateSelectBranchDocument") }}

{{ get_typedoc_desc("Mutations.Branches.GenerateSelectBranchDocument") }}

{{ get_typedoc_input("Mutations.Branches.GenerateSelectBranchDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Branches.GenerateSelectBranchDocument", "IOutput") }}

### Выбор участка пайщиком

{{ get_sdk_doc("Mutations", "Branches", "SelectBranch") }} | {{ get_graphql_doc("Mutation.selectBranch") }}

{{ get_typedoc_desc("Mutations.Branches.SelectBranch") }}

{{ get_typedoc_input("Mutations.Branches.SelectBranch") }}

Результат:

{{ get_typedoc_definition("Mutations.Branches.SelectBranch", "IOutput") }}

### Добавить доверенное лицо

{{ get_sdk_doc("Mutations", "Branches", "AddTrustedAccount") }} | {{ get_graphql_doc("Mutation.addTrustedAccount") }}

{{ get_typedoc_desc("Mutations.Branches.AddTrustedAccount") }}

{{ get_typedoc_input("Mutations.Branches.AddTrustedAccount") }}

Результат:

{{ get_typedoc_definition("Mutations.Branches.AddTrustedAccount", "IOutput") }}

### Удалить доверенное лицо

{{ get_sdk_doc("Mutations", "Branches", "DeleteTrustedAccount") }} | {{ get_graphql_doc("Mutation.deleteTrustedAccount") }}

{{ get_typedoc_desc("Mutations.Branches.DeleteTrustedAccount") }}

{{ get_typedoc_input("Mutations.Branches.DeleteTrustedAccount") }}

Результат:

{{ get_typedoc_definition("Mutations.Branches.DeleteTrustedAccount", "IOutput") }}

{{ dev_blockchain_note() }}



