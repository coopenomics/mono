export interface GetPaymentMethodDomainInterface {
  username: string;
  // Было `'spb'` — опечатка: и сама сущность метода, и все тринадцать мест в
  // коде знают перевод по телефону как `'sbp'`. Отбор по этому типу поэтому
  // не составлялся вовсе — компилятор не дал бы передать правильное значение.
  method_type?: 'bank_transfer' | 'sbp';
  method_id?: string;
  is_default?: boolean;
  block_num?: number;
}
