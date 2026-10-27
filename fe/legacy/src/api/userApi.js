import axiosInstance from './axiosInstance';

export const userApi = {
  getUsers: (page = 0, size = 20) => axiosInstance.get('/api/users', { params: { page, size } }),
  setUserActiveStatus: (id, active) => axiosInstance.patch(`/api/users/${id}/active-status`, { active }),
};
