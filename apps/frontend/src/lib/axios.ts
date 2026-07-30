import axios from 'axios';
import { CONFIG } from '../global-config.ts';
import { ApiError } from './api-error.ts';

const axiosInstance = axios.create({
  baseURL: CONFIG.serverUrl,
  headers: {
    Accept: 'application/json',
  },
  // No credentials: the backend holds no session and no user data, so there is
  // nothing to send. Leaving this on made the browser reject every reply, because
  // the backend's CORS does not set `Access-Control-Allow-Credentials` -- a leftover
  // from when there was a server-side session to carry.
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const apiError = ApiError.fromAxios(
      error?.response?.data,
      status,
      error?.message,
    );
    return Promise.reject(apiError);
  }
);

export default axiosInstance;

export const endpoints = {
  profile: '/api/profile',
  exchange: '/api/exchange',
} as const;
