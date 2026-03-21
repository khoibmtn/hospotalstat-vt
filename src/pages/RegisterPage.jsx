import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser, sanitizeNickname } from '../services/authService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, ROLE_LABELS, POSITIONS, TITLES } from '../utils/constants';

export default function RegisterPage() {
  const [departmentId, setDepartmentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [position, setPosition] = useState(POSITIONS[3]); // Default: Nhân viên
  const [title, setTitle] = useState(TITLES[0]); // Default: Bác sĩ
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [departments, setDepartments] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    async function loadData() {
      const [facs, depts] = await Promise.all([getFacilities(), getDepartments()]);
      setFacilities(facs);
      setDepartments(depts);
      if (depts.length > 0) setDepartmentId(depts[0].id);
    }
    loadData();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');


    if (!fullName.trim()) {
      setError('Vui lòng nhập họ tên.');
      return;
    }
    if (!nickname.trim()) {
      setError('Vui lòng nhập nickname.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (!/^[a-z0-9.]+$/.test(nickname.trim())) {
      setError('Nickname chỉ được phép chứa chữ cái thường không dấu, số và dấu chấm, không có khoảng trắng.');
      return;
    }

    setLoading(true);
    try {
      await registerUser(nickname.trim(), password, {
        role: ROLES.KHOA,
        departmentId,
        fullName: fullName.trim(),
        position,
        title,
      });
      // Navigation is handled by the useEffect watching the 'user' state
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  }

  const groupedDepts = facilities.map((f) => ({
    ...f,
    depts: departments.filter((d) => d.facilityId === f.id),
  }));

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: '480px' }}>
        <div className="auth-card__title">🏥 Đăng ký</div>
        <div className="auth-card__subtitle">
          Tạo tài khoản mới để nhập liệu
        </div>

        <form className="auth-card__form" onSubmit={handleSubmit}>
          {error && (
            <div className="badge badge-error" style={{ padding: '8px 12px', fontSize: '0.8125rem', borderRadius: '8px', width: '100%', justifyContent: 'center' }}>
              {error}
            </div>
          )}

          {/* 1. Khoa */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-dept">Khoa / Phòng</label>
            <select
              id="reg-dept"
              className="form-input"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              autoFocus
            >
              <option value="">-- Chọn khoa --</option>
              {groupedDepts.map((facility) => (
                <optgroup key={facility.id} label={facility.name}>
                  {facility.depts.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* 2. Họ tên */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-fullname">Họ và tên</label>
            <input
              id="reg-fullname"
              className="form-input"
              type="text"
              placeholder="Ví dụ: Nguyễn Văn Minh"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {/* 3. Nickname */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-nickname">Nickname (tên đăng nhập)</label>
            <input
              id="reg-nickname"
              className="form-input"
              type="text"
              placeholder="Ví dụ: bs.minh (chỉ chữ thường, số, chấm)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          {/* 4. Chức vụ */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-position">Chức vụ</label>
            <select
              id="reg-position"
              className="form-input"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 5. Chức danh */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-title">Chức danh</label>
            <select
              id="reg-title"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            >
              {TITLES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* 6-7. Mật khẩu */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Mật khẩu (tối thiểu 6 ký tự)</label>
            <input
              id="reg-password"
              className="form-input"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Nhập lại mật khẩu</label>
            <input
              id="reg-confirm"
              className="form-input"
              type="password"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <div className="auth-card__footer">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
