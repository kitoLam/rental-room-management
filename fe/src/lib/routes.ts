/** Đường dẫn dùng chung để không viết cứng chuỗi URL trong component. */
export const routes = {
  home: '/',
  rooms: '/rooms',
  roomDetail: (id: string) => `/rooms/${id}`,
  login: '/login',
  register: '/register',
  myRoom: '/tenant/my-room',
} as const
