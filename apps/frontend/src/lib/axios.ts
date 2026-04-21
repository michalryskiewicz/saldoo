import axios from 'axios';
import { CONFIG } from '../global-config.ts';

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
    const message = error?.response?.data?.message || error?.message || 'Something went wrong!';
    console.error('Axios error:', message);
    return Promise.reject(new Error(message));
  }
);

export default axiosInstance;

export const endpoints = {
  profile: '/api/profile',
  exchange: '/api/exchange',
} as const;
