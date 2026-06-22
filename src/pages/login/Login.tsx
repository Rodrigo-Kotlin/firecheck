import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Flame, Eye, EyeOff, LogIn } from 'lucide-react';
import { showToast } from '../../hooks/useToasts';
import { isAuthError } from '../../services/authService';
import { isSupabaseConfigured } from '../../lib/supabase';

const LAST_EMAIL_KEY = 'firecheck-last-email';

export default function Login() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const authLoading = useAppStore((s) => s.authLoading);
  const login = useAppStore((s) => s.login);

  const [email, setEmail] = useState(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authReady && user) {
      void navigate('/', { replace: true });
    }
  }, [authReady, user, navigate]);

  const handleAuthError = (err: unknown) => {
    if (isAuthError(err)) {
      showToast({ kind: 'error', title: err.message });
      return;
    }
    console.error('[auth]', err);
    showToast({
      kind: 'error',
      title: 'Não foi possível entrar.',
      description: 'Verifique sua conexão e tente novamente.',
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast({ kind: 'warning', title: 'Preencha e-mail e senha.' });
      return;
    }
    if (!isSupabaseConfigured) {
      showToast({
        kind: 'error',
        title: 'Servidor de autenticação indisponível.',
        description: 'Verifique as variáveis VITE_SUPABASE_* no .env.',
      });
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
      showToast({ kind: 'success', title: 'Bem-vindo de volta!' });
      void navigate('/', { replace: true });
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || authLoading;

  return (
    <div className="min-h-screen bg-neutralBg flex flex-col justify-center px-4 sm:px-6 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md flex flex-col items-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg mb-4">
          <Flame className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-1">
          Fire<span className="text-primary">Check</span>
        </h1>
        <p className="label-uppercase mb-6 sm:mb-8 text-center">
          Sistema de Inspeção de Incêndio
        </p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="bg-white py-7 px-6 sm:py-8 sm:px-8 border border-gray-100 rounded-2xl shadow-subtle">
          <div className="flex items-center gap-2 mb-6">
            <LogIn className="w-5 h-5 text-primary" />
            <h2 className="text-base font-black text-gray-900 uppercase tracking-wide">
              Entrar na sua conta
            </h2>
          </div>

          <form className="space-y-5" onSubmit={handleLogin} noValidate>
            <div>
              <label htmlFor="login-email" className="label-uppercase block mb-2">
                E-mail
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@firecheck.com"
                className="field-input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="label-uppercase">
                  Senha
                </label>
                <Link
                  to="/recuperar-senha"
                  className="text-[11px] font-black uppercase tracking-wider text-primary hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field-input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-md"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn-primary"
            >
              {busy ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-400 mt-5">
            Ainda não tem conta?{' '}
            <Link
              to="/cadastro"
              className="text-primary font-black uppercase tracking-wider hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          FireCheck v1.0.0 · PWA Offline-First
        </p>
        <p className="text-[11px] text-slate-400 text-center opacity-70 mt-1">
          by Efetiva SST
        </p>
      </div>
    </div>
  );
}
