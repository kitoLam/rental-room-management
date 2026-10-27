import { useState } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, MailCheck, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/authApi';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState(token ? 'ready' : 'invalid');
  const [error, setError] = useState(token ? '' : 'Liên kết xác thực không chứa mã hợp lệ.');

  const verify = async () => {
    setStatus('loading');
    setError('');
    try {
      await authApi.verifyEmail(token);
      setStatus('success');
    } catch (requestError) {
      setStatus('invalid');
      setError(requestError.response?.data?.message || 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.');
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-showcase">
        <div className="auth-brand">
          <div className="auth-brand-mark"><ShieldCheck size={21} strokeWidth={2.4} /></div>
          <span>SBA <span className="auth-brand-light">/ AUTH LAB</span></span>
        </div>
        <div className="auth-pitch">
          <div className="auth-eyebrow"><span className="auth-eyebrow-dot" /> EMAIL VERIFICATION</div>
          <h1>Một bước nữa.<br /><span>Tài khoản của bạn đã sẵn sàng.</span></h1>
          <p>Xác nhận địa chỉ email để bảo vệ tài khoản và hoàn tất quá trình đăng ký.</p>
        </div>
        <div className="auth-showcase-footer"><span>SPRING BOOT · JWT · POSTGRESQL</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap auth-verification-card">
          <div className="auth-mobile-brand">
            <div className="auth-brand-mark"><ShieldCheck size={20} /></div>
            <span>SBA <span className="auth-brand-light">/ AUTH LAB</span></span>
          </div>
          <div className={`auth-verification-icon ${status === 'success' ? 'is-success' : ''}`}>
            {status === 'success' ? <CheckCircle2 size={25} /> : <MailCheck size={25} />}
          </div>
          <div className="auth-heading">
            <span className="auth-kicker">ACCOUNT VERIFICATION</span>
            <h2>{status === 'success' ? 'Email đã được xác thực' : 'Xác nhận email của bạn'}</h2>
            <p>
              {status === 'success'
                ? 'Tài khoản đã được kích hoạt. Bạn có thể đăng nhập ngay bây giờ.'
                : 'Nhấn nút bên dưới để xác nhận địa chỉ email và kích hoạt tài khoản.'}
            </p>
          </div>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {status === 'ready' && (
            <button className="auth-submit" onClick={verify} type="button">
              Xác thực email <ArrowRight size={17} />
            </button>
          )}
          {status === 'loading' && (
            <button className="auth-submit" disabled type="button">
              <LoaderCircle className="auth-spinner" size={18} /> Đang xác thực...
            </button>
          )}
          {status === 'success' && (
            <Link className="auth-submit auth-submit-link" to="/login">
              Đến trang đăng nhập <ArrowRight size={17} />
            </Link>
          )}
          {status === 'invalid' && (
            <Link className="auth-submit auth-submit-link" to="/login">
              Quay lại đăng nhập <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </section>
    </main>
  );
};

export default VerifyEmailPage;
