import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { isFirebaseConfigured } from '../config/firebase';

export default function LoginPage() {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!nickname.trim() || !password) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    setLoading(true);
    try {
      await loginUser(nickname.trim(), password);
      // Navigation is handled by the useEffect watching the 'user' state
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__title">🏥 HospotalStat</div>
        <div className="auth-card__subtitle">
          Đăng nhập để nhập liệu số liệu KCB
        </div>

        <form className="auth-card__form" onSubmit={handleSubmit}>
          {!isFirebaseConfigured && (
            <div className="badge badge-warning" style={{ padding: '10px 12px', fontSize: '0.8125rem', borderRadius: '8px', width: '100%', justifyContent: 'center', textAlign: 'center' }}>
              ⚠️ Chưa cấu hình Firebase. Tạo file <code>.env</code> từ <code>.env.example</code> rồi restart server.
            </div>
          )}

          {error && (
            <div className="badge badge-error" style={{ padding: '8px 12px', fontSize: '0.8125rem', borderRadius: '8px', width: '100%', justifyContent: 'center' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              className="form-input"
              type="text"
              placeholder="Nhập nickname của bạn"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              className="form-input"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="auth-card__footer">
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </div>
      </div>
    </div>
  );
}
