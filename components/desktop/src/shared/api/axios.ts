import axios from 'axios';
import { resolveAccessToken } from './access-token';
import { env } from 'src/shared/config';

export async function sendGET(
  url: string,
  params?: object,
  skip_auth = false
): Promise<any> {
  try {
    if (!skip_auth) {
      const token = await resolveAccessToken();

      const response = await axios.get(env.BACKEND_URL + url, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } else {
      const response = await axios.get(env.BACKEND_URL + url, {
        params,
      });
      return response.data;
    }
  } catch (e: any) {
    if (e.response && e.response.data && e.response.data.message) {
      // TODO обработать e.response.data.subcode как тип ошибки от блокчейна по https://github.com/EOSIO/eos/blob/v1.1.4/libraries/chain/include/eosio/chain/exceptions.hpp
      throw new Error(e.response.data.message);
    } else {
      throw new Error(e.message);
      // throw new Error('Возникла ошибка соединения')
    }
  }
}

export async function sendPOST(
  url: string,
  data?: object,
  skip_auth = false
): Promise<any> {
  try {
    if (!skip_auth) {
      const token = await resolveAccessToken();

      const response = await axios.post(env.BACKEND_URL + url, data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } else {
      const response = await axios.post(env.BACKEND_URL + url, data);
      return response.data;
    }
  } catch (e: any) {
    if (e.response && e.response.data && e.response.data.message) {
      //TODO обработать e.response.data.subcode как тип ошибки от блокчейна по https://github.com/EOSIO/eos/blob/v1.1.4/libraries/chain/include/eosio/chain/exceptions.hpp
      throw new Error(e.response.data.message);
    } else {
      throw new Error(e.message);
      // throw new Error('Возникла ошибка соединения')
    }
  }
}
