import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CircleUserRound, LogOut, Search, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../api/userApi';
import { useAuth } from '../../context/auth-context';
import { useToast } from '../../components/common/Toast';
import './manage-accounts.css';

const PAGE_SIZE = 20;

const readPage = (response) => response.data?.data;

const statusLabel = (status) => {
  if (status === 'ACTIVE') return 'Đang hoạt động';
  if (status === 'DISABLED') return 'Đã vô hiệu hóa';
  if (status === 'LOCKED') return 'Đang khóa';
  if (status === 'PENDING_VERIFICATION') return 'Chờ xác minh';
  return 'Chưa kích hoạt';
};

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const ManageAccountsPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const loadUsers = useCallback(async (requestedPage) => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await userApi.getUsers(requestedPage, PAGE_SIZE);
      const result = readPage(response);
      setUsers(result?.content || []);
      setPage(result?.number || 0);
      setTotalPages(result?.totalPages || 0);
      setTotalElements(result?.totalElements || 0);
    } catch {
      setLoadError('Không tải được danh sách tài khoản. Hãy thử tải lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers(0);
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    if (!query) return users;
    return users.filter((account) =>
      [account.fullName, account.email, account.phone]
        .some((value) => value?.toLocaleLowerCase('vi').includes(query)),
    );
  }, [search, users]);

  const handleStatusChange = async (account) => {
    const active = account.status !== 'ACTIVE';
    setUpdatingId(account.id);
    try {
      const response = await userApi.setUserActiveStatus(account.id, active);
      const updatedAccount = readPage(response);
      setUsers((current) => current.map((item) => item.id === account.id ? updatedAccount : item));
      toast.success(active ? 'Đã kích hoạt tài khoản.' : 'Đã vô hiệu hóa tài khoản.');
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể cập nhật trạng thái tài khoản.';
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      toast.error('Phiên đã được xóa khỏi trình duyệt nhưng máy chủ chưa xác nhận đăng xuất.');
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <main className="accounts-page">
      <header className="accounts-topbar">
        <button className="accounts-back" type="button" onClick={() => navigate('/')}>
          <ArrowLeft size={17} />
          <span>Quay lại phiên</span>
        </button>
        <div className="accounts-brand">
          <div className="accounts-brand-icon"><ShieldCheck size={18} /></div>
          <span>SBA <small>/ ADMIN</small></span>
        </div>
        <button className="accounts-logout" type="button" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </button>
      </header>

      <div className="accounts-content">
        <div className="accounts-heading">
          <div>
            <span className="accounts-kicker">QUẢN TRỊ HỆ THỐNG</span>
            <h1>Quản lý tài khoản</h1>
            <p>Chỉ xem thông tin cơ bản và bật hoặc tắt quyền hoạt động của tài khoản.</p>
          </div>
          <div className="accounts-admin-chip"><CircleUserRound size={16} />{user?.fullName || 'Administrator'}</div>
        </div>

        <section className="accounts-summary">
          <div className="accounts-summary-icon"><Users size={20} /></div>
          <div><strong>{totalElements.toLocaleString('vi-VN')}</strong><span>Tài khoản trong hệ thống</span></div>
          <div className="accounts-privacy"><ShieldCheck size={16} />Thông tin mật khẩu và bảo mật không được hiển thị</div>
        </section>

        <section className="accounts-panel">
          <div className="accounts-toolbar">
            <div>
              <h2>Danh sách tài khoản</h2>
              <span>Trang {totalPages ? page + 1 : 0} / {totalPages}</span>
            </div>
            <label className="accounts-search">
              <Search size={17} />
              <input
                aria-label="Tìm tài khoản trong trang hiện tại"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên, email hoặc số điện thoại"
                value={search}
              />
            </label>
          </div>

          {loadError && (
            <div className="accounts-error" role="alert">
              <span>{loadError}</span>
              <button type="button" onClick={() => loadUsers(page)}>Thử lại</button>
            </div>
          )}

          <div className="accounts-table-wrap">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Số điện thoại</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                  <th className="accounts-action-heading">Hoạt động</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td className="accounts-empty" colSpan="5">Đang tải danh sách tài khoản...</td></tr>
                )}
                {!loading && !loadError && filteredUsers.map((account) => {
                  const active = account.status === 'ACTIVE';
                  const updating = updatingId === account.id;
                  return (
                    <tr key={account.id}>
                      <td>
                        <div className="accounts-person">
                          <span className="accounts-avatar">{(account.fullName || '?').trim().charAt(0).toLocaleUpperCase('vi')}</span>
                          <span className="accounts-person-copy">
                            <strong>{account.fullName}</strong>
                            <span>{account.email || 'Chưa có email'}</span>
                          </span>
                        </div>
                      </td>
                      <td className="accounts-phone">{account.phone || '—'}</td>
                      <td className="accounts-date">{formatDate(account.createdAt)}</td>
                      <td>
                        <span className={`accounts-status ${active ? 'is-active' : 'is-inactive'}`}>
                          <i />
                          {statusLabel(account.status)}
                        </span>
                      </td>
                      <td className="accounts-action-cell">
                        <button
                          aria-label={`${active ? 'Vô hiệu hóa' : 'Kích hoạt'} ${account.fullName}`}
                          aria-checked={active}
                          className={`accounts-toggle ${active ? 'is-on' : ''}`}
                          disabled={updating}
                          onClick={() => handleStatusChange(account)}
                          role="switch"
                          type="button"
                        >
                          <span />
                        </button>
                        <span className="accounts-toggle-label">{updating ? 'Đang lưu' : active ? 'Bật' : 'Tắt'}</span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !loadError && filteredUsers.length === 0 && (
                  <tr>
                    <td className="accounts-empty" colSpan="5">
                      {users.length ? 'Không tìm thấy tài khoản phù hợp trên trang này.' : 'Chưa có tài khoản nào.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="accounts-pagination">
            <span>Hiển thị {users.length ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, totalElements)} / {totalElements}</span>
            <div>
              <button aria-label="Trang trước" disabled={loading || page <= 0} onClick={() => loadUsers(page - 1)} type="button"><ChevronLeft size={17} /></button>
              <button aria-label="Trang sau" disabled={loading || page + 1 >= totalPages} onClick={() => loadUsers(page + 1)} type="button"><ChevronRight size={17} /></button>
            </div>
          </footer>
        </section>
        <p className="accounts-footnote">Thay đổi trạng thái không cho phép quản trị viên xem hoặc sửa thông tin xác thực của người dùng.</p>
      </div>
    </main>
  );
};

export default ManageAccountsPage;
