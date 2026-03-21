import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { isFirebaseConfigured } from '../config/firebase';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertTriangle, LogIn } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader className="space-y-1 text-center bg-slate-50/50 border-b border-slate-100 rounded-t-xl mb-4">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-2">
            <span className="text-2xl">🏥</span> HospotalStat
          </CardTitle>
          <CardDescription className="text-slate-500">
            Đăng nhập để nhập liệu số liệu KCB
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isFirebaseConfigured && (
              <div className="bg-amber-50 text-amber-800 border border-amber-200 p-3 rounded-lg text-sm flex gap-2 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold block mb-1">Chưa cấu hình Firebase</span>
                  Tạo file <code className="bg-amber-100 px-1 rounded text-amber-900 font-mono text-xs">.env</code> từ <code className="bg-amber-100 px-1 rounded text-amber-900 font-mono text-xs">.env.example</code> rồi restart server.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-lg text-sm text-center font-medium animate-in fade-in zoom-in duration-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-slate-700 font-medium">Tên đăng nhập (Nickname)</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="Nhập nickname của bạn"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="username"
                autoFocus
                className="h-11 focus-visible:ring-blue-500 focus-visible:ring-offset-1 text-base bg-white shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-11 focus-visible:ring-blue-500 focus-visible:ring-offset-1 text-base bg-white shadow-sm"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all relative overflow-hidden group"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang đăng nhập...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                  Đăng nhập
                </span>
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex justify-center border-t border-slate-100 py-4 bg-slate-50/50 rounded-b-xl mt-2">
          <p className="text-sm text-slate-600">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
              Đăng ký ngay
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
