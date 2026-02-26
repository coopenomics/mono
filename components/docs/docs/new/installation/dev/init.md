После установки программного обеспечения `MONO` его необходимо инициализировать, предоставим информацию о кооперативе, который будет обслуживаться системой. Для инициализации потребуется приватный ключ доступа, который выдаётся оператором платформы [Кооперативной Экономики](https://coopenomics.world). Для получения ключа перейдите в раздел [Подключение](/connect) и действуйте по инструкциям.

!!!note "В целях тестирования"
    В целях тестирования вы можете воспользоваться тестовым (общедоступным) кооперативом по адресу https://testnet.coopenomics.world, воспользовавшись электронной почтой: `chairman.voskhod@gmail.com` и ключом `5Hs46kBWGMKnsqntqLCinp6QSCuuWkc39DLMzaNaUjv3TFLif2U` для входа. Также, эти данные могут использоваться для подключения SDK к GraphQL-API по адресу `https://testnet.coopenomics.world/backend/v1/graphql`


## Инициализация
Для начала работы вашему приложению `MONO` необходимо сообщить информацию о том кооперативе, для которого он будет работать. Для этого используйте мутацию `initSystem`:

{{ get_sdk_doc("Mutations", "System", "InitSystem") }} | {{ get_graphql_doc("mutation.initSystem") }}

Пример вызова:

```typescript
import { Mutations, OrganizationType } from "@coopenomics/sdk";

const variables: Mutations.System.InitSystem.IInput = {
  data: {
    organization_data: {
      bank_account: {
        account_number: "40703810338000220228",
        bank_name: "АО Альфа-Банк",
        currency: "RUB",
        details: {
          bik: "044525593",
          corr: "30101810200000000593",
          kpp: "770801001"
        }
      },
      city: "Санкт-Петербург",
      country: "Russia",
      details: {
        inn: "7826012345",
        kpp: "782601001",
        ogrn: "1234567890123"
      },
      fact_address: "190000, г. Санкт-Петербург, ул. Ленина, д. 5, офис 12",
      full_address: "190000, г. Санкт-Петербург, ул. Ленина, д. 5, офис 12",
      full_name: 'Потребительский Кооператив "Ромашка"',
      phone: "+78121234567",
      represented_by: {
        based_on: "Решение общего собрания №2",
        first_name: "Иван",
        last_name: "Петров",
        middle_name: "Сергеевич",
        position: "Председатель"
      },
      short_name: "ПК Ромашка",
      type: OrganizationType.COOP
    },
    vars: {
      confidential_email: "privacy@romashka-coop.ru",
      confidential_link: "romashka-coop.ru/privacy",
      contact_email: "contact@romashka-coop.ru",
      coopname: "romashka",
      full_abbr: "потребительский кооператив",
      full_abbr_dative: "потребительскому кооперативу",
      full_abbr_genitive: "потребительского кооператива",
      name: "Ромашка",
      participant_application: {
        protocol_day_month_year: "15 мая 2024 г.",
        protocol_number: "15-05-2024"
      },
      passport_request: "yes",
      privacy_agreement: {
        protocol_day_month_year: "15 мая 2024 г.",
        protocol_number: "15-05-2024"
      },
      short_abbr: "ПК",
      signature_agreement: {
        protocol_day_month_year: "15 мая 2024 г.",
        protocol_number: "15-05-2024"
      },
      user_agreement: {
        protocol_day_month_year: "15 мая 2024 г.",
        protocol_number: "15-05-2024"
      },
      wallet_agreement: {
        protocol_day_month_year: "15 мая 2024 г.",
        protocol_number: "15-05-2024"
      },
      website: "ромашка-кооп.рф"
    }
  }
};

// вызываем метод SDK для инициализации и передаём объект с переменными
const { [Mutations.System.InitSystem.name]: result } = await client.Mutation(
  Mutations.System.InitSystem.mutation, { variables }
);


```

В результате успешного выполнения мутации, в хранилище приватных данных кооператива будет добавлена запись об организации, пайщиками которой будут становиться пользователи. 


## Установка ключа
Бэкенд приложения `MONO` хранит приватный ключ кооператива, которым он подписывает транзакции в блокчейне. Ключ хранится в зашифрованном виде в базе данных, извлекается оттуда и расшифровывается для использования только когда это необходимо. Работа системы без приватного ключа невозможна. Чтобы предоставить ключ бэкенду MONO, необходимо выполнить мутацию `setWif`: 

{{ get_sdk_doc("Mutations", "System", "SaveWif") }} | {{ get_graphql_doc("Mutation.setWif") }}

```typescript
import { Mutations } from "@coopenomics/sdk";

const variables: Mutations.System.InstallSystem.IInput = {
  data: {
    permission: "active",
    username: "имя_аккаунта_кооператива",
    wif: "приватный_ключ"
  }
}

```

Ключ будет зашифрован и сохранён в базе данных кооператива для дальнейшего использования системой по мере необходимости. 


## Установка совета
После успешного выполнения инициализации необходимо установить членов совета с указанием их приватных данных. Для этого используем метод installSystem:

{{ get_sdk_doc("Mutations", "System", "InstallSystem") }} | {{ get_graphql_doc("Mutation.installSystem") }}

```typescript
import { Mutations } from "@coopenomics/sdk";

// Формируем объект для добавления в систему chairman (председатель) и member (член совета)
const variables: Mutations.System.InstallSystem.IInput = {
  data: {
    soviet: [
      {
        individual_data: {
          birthdate: "1980-05-15",
          first_name: "Иван",
          last_name: "Петров",
          middle_name: "Алексеевич",
          full_address: "Москва, ул. Тверская, д. 10, кв. 5",
          phone: "+79161234567",
          email: 'ivan-petrov@romashka.com'
        },
        role: "chairman"
      },
      {
        individual_data: {
          birthdate: "1992-09-23",
          first_name: "Алексей",
          last_name: "Смирнов",
          middle_name: "Владимирович",
          full_address: "Санкт-Петербург, пр. Невский, д. 45, кв. 12",
          phone: "+79217654321"
          email: "aleksei-smirnov@yandex.ru"
        },
        role: "member"
      }
      //... продолжить столько раз, сколько членов в совете кооператива
    ]
  }
}


const { [Mutations.System.InstallSystem.name]: result } = await client.Mutation(
  Mutations.System.InstallSystem.mutation,
  {
    variables,
  }
);

```

!!!warning "Важно!"
    Один из членов совета обязательно должен обладать ролью 'chairman' (председатель).

Всем указанным физическим лицам будут зарегистрированы имена аккаунтов в блокчейне, а MONO сохранит данные физических лиц в своей базе и отправит приглашения для членов совета на указанные электронные почтовые адреса. 

!!! note ""
    При регистрации аккаунтов в блокчейне с аккаунта кооператива списываются AXON. Поэтому, убедитесь, что у вас есть AXON в достаточном количестве. Стоимость регистрации одного аккаунта ~1 AXON, или ~10 рублей. Токены `AXON` выдаются оператором системы при подключении и оплате членского взноса. 


## Выпуск ключей

После того, как все члены совета будут добавлены методом installSystem, каждый из них получит оповещение на электронную почту с приглашением получить приватный ключ доступа к системе своего кооператива. Срок действия ссылки для выпуска ключа - 24 часа. 

Если по истечению 24 часов ссылка не будет использована, то члену совета для входа будет необходимо воспользоваться методом сброса приватного ключа к его аккаунту. Для этого в терминале ему необходимо нажать кнопку "потяряли ключ?" и следовать инструкциям (см. подробнее [здесь](/participants/restore). 

Выпуск ключа осуществляется на стороне пользователя в браузерне, и для этого ему необходимо перейти по ссылке, которую он получит. После чего, отправить его публичную часть в MONO для установки в блокчейне методом resetKey. 

{{ get_sdk_doc("Mutations", "System", "InstallSystem") }} | {{ get_graphql_doc("Mutation.installSystem") }}

```typescript
import { Mutations } from "@coopenomics/sdk";

const variables: Mutations.Auth.ResetKey.IInput = {
  data: {
    public_key: "EOS....публичный_ключ",
    token: "токен,_полученный_на_email"
  }
}

const { [Mutations.Auth.ResetKey.name]: result } = await client.Mutation(
  Mutations.Auth.ResetKey.mutation,
  {
    variables,
  }
);

```


После выпуска ключа и установки его в блокчейне методом ResetKey, пайщик может воспользоваться входом. 