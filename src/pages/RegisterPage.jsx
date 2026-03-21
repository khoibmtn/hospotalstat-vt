import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/authService';
import { getDepartments, getFacilities } from '../services/departmentService';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, POSITIONS, TITLES } from '../utils/constants';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 py-12">
      <Card className="w-full max-w-lg shadow-lg border-slate-200">
        <CardHeader className="space-y-1 text-center bg-slate-50/50 border-b border-slate-100 rounded-t-xl mb-4">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-2">
            <span className="text-2xl">🏥</span> Đăng ký tài khoản
          </CardTitle>
          <CardDescription className="text-slate-500">
            Tạo tài khoản mới để tham gia hệ thống HospitalStat
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-lg text-sm text-center font-medium animate-in fade-in zoom-in duration-200">
                {error}
              </div>
            )}

            {/* 1. Khoa */}
            <div className="space-y-2">
              <Label htmlFor="reg-dept" className="text-slate-700 font-medium">Khoa trực thuộc</Label>
              <select
                id="reg-dept"
                className="flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-base ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                autoFocus
              >
                <option value="" disabled>-- Chọn khoa của bạn --</option>
                {groupedDepts.map((facility) => (
                  <optgroup key={facility.id} label={facility.name} className="font-semibold text-slate-900">
                    {facility.depts.map((dept) => (
                      <option key={dept.id} value={dept.id} className="font-normal text-slate-700">{dept.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 2. Họ tên */}
              <div className="space-y-2">
                <Label htmlFor="reg-fullname" className="text-slate-700 font-medium">Họ và tên</Label>
                <Input
                  id="reg-fullname"
                  type="text"
                  placeholder="VD: Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 focus-visible:ring-blue-500 focus-visible:ring-offset-1 text-base bg-white shadow-sm"
                />
              </div>

              {/* 3. Nickname */}
              <div className="space-y-2">
                <Label htmlFor="reg-nickname" className="text-slate-700 font-medium">Tên đăng nhập (Nickname)</Label>
                <Input
                  id="reg-nickname"
                  type="text"
                  placeholder="VD: bs.nguyena"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="h-11 focus-visible:ring-blue-500 focus-visible:ring-offset-1 text-base bg-white shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 4. Chức vụ */}
              <div className="space-y-2 flex flex-col justify-end">
                <Label className="text-slate-700 font-medium">Chức vụ</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="h-11 bg-white shadow-sm focus:ring-blue-500 focus:ring-offset-1">
                    <SelectValue placeholder="Chọn chức vụ" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 5. Chức danh */}
              <div className="space-y-2 flex flex-col justify-end">
                <Label className="text-slate-700 font-medium">Chức danh</Label>
                <Select value={title} onValueChange={setTitle}>
                  <SelectTrigger className="h-11 bg-white shadow-sm focus:ring-blue-500 focus:ring-offset-1">
                    <SelectValue placeholder="Chọn chức danh" />
                  </SelectTrigger>
                  <SelectContent>
                    {TITLES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 6-7. Mật khẩu */}
            <div className="space-y-2">
              <Label htmlFor="reg-password" className="text-slate-700 font-medium">Mật khẩu</Label>
              <Input
                id="reg-password"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 focus-visible:ring-blue-500 focus-visible:ring-offset-1 text-base bg-white shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-confirm" className="text-slate-700 font-medium">Nhập lại mật khẩu</Label>
              <Input
                id="reg-confirm"
                type="password"
                placeholder="Xác nhận lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 focus-visible:ring-blue-500 focus-visible:ring-offset-1 text-base bg-white shadow-sm"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all relative overflow-hidden group mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserPlus className="w-5 h-5 transition-transform group-hover:scale-110" />
                  Tạo tài khoản
                </span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-slate-100 py-4 bg-slate-50/50 rounded-b-xl mt-2">
          <p className="text-sm text-slate-600">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
              Đăng nhập ngay
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
