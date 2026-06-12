// Публичный сертификат физического лица — только ФИО и имя аккаунта
const rawIndividualCertificateSelector = {
  type: true,
  username: true,
  first_name: true,
  last_name: true,
  middle_name: true,
}

export { rawIndividualCertificateSelector }
