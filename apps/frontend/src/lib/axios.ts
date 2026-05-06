import axios from 'axios';
import { CONFIG } from '../global-config.ts';
import { ApiError } from './api-error.ts';

const axiosInstance = axios.create({
  baseURL: CONFIG.serverUrl,
  headers: {
    Accept: 'application/json',
  },
  withCredentials: true,
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
