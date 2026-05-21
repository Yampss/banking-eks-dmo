import axios from 'axios';

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/api/users/register', data),
  login: (data) => api.post('/api/users/login', data),
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (data) => api.put('/api/users/profile', data),
};

export const accountAPI = {
  create: (data) => api.post('/api/accounts', data),
  getMyAccounts: () => api.get('/api/accounts/my'),
  getById: (id) => api.get(`/api/accounts/${id}`),
  getByNumber: (num) => api.get(`/api/accounts/number/${num}`),
};

export const transactionAPI = {
  deposit: (data) => api.post('/api/transactions/deposit', data),
  withdraw: (data) => api.post('/api/transactions/withdraw', data),
  transfer: (data) => api.post('/api/transactions/transfer', data),
  getMyTransactions: (params) => api.get('/api/transactions/my', { params }),
  getAccountTransactions: (accountId, params) => api.get(`/api/transactions/account/${accountId}`, { params }),
};



export default api;
