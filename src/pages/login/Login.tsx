import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Flame, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { showToast } from '../../hooks/useToasts';
import { isAuthError } from '../../services/authService';
import PasswordStrengthMeter from '../../components/PasswordStrengthMeter';

type Mode = 'login' | 'register';

const LAST_EMAIL_KEY = 'firecheck-last-email';

export default function Login() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const authLoading = useAppStore((s) => s.authLoading);
  const login = useAppStore((s) => s.login);
  const register = useAppStore((s) => s.register);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('Inspetor');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If the user is already logged in, bounce them to the app.
  useEffect(() => {
    if (authReady && user) {
      void navigate('/', { replace: true });
    }
  }, [authReady, user, navigate]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setPassword('');
    setConfirmPassword('');
    setNome('');
    setMode(next);
  };

  const handleAuthError = (err: unknown) => {
    if (isAuthError(err)) {
      showToast({ kind: 'error', title: err.message });
      return;
    }
    console.error('[auth]', err);
    showToast({
      kind: 'error',
      title: 'Não foi possível concluir a operação.',
      description: 'Tente novamente em instantes.',
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast({ kind: 'warning', title: 'Preencha e-mail e senha.' });
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !nome || !cargo) {
      showToast({ kind: 'warning', title: 'Preencha todos os campos.' });
      return;
    }
    if (password !== confirmPassword) {
      showToast({ kind: 'warning', title: 'As senhas não coincidem.' });
      return;
    }
    setSubmitting(true);
    try {
      await register({ email, password, nome, cargo });
      localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
      showToast({
        kind: 'success',
        title: 'Conta criada!',
        description: `Bem-vindo, ${nome.split(' ')[0]}.`,
      });
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
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg mb-4 animate-bounce">
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
          {/* Segmented control */}
          <div
            role="tablist"
            aria-label="Modo de autenticação"
            className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl mb-6"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`flex items-center justify-center gap-1.5 h-10 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                mode === 'login'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`flex items-center justify-center gap-1.5 h-10 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                mode === 'register'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Criar Conta
            </button>
          </div>

          {mode === 'login' ? (
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
                <label htmlFor="login-password" className="label-uppercase block mb-2">
                  Senha
                </label>
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
          ) : (
            <form className="space-y-4" onSubmit={handleRegister} noValidate>
              <div>
                <label htmlFor="reg-nome" className="label-uppercase block mb-2">
                  Nome completo
                </label>
                <input
                  id="reg-nome"
                  name="nome"
                  type="text"
                  autoComplete="name"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="field-input"
                />
              </div>

              <div>
                <label htmlFor="reg-cargo" className="label-uppercase block mb-2">
                  Cargo / Função
                </label>
                <input
                  id="reg-cargo"
                  name="cargo"
                  type="text"
                  autoComplete="organization-title"
                  required
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Inspetor, Engenheiro, etc."
                  className="field-input"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="label-uppercase block mb-2">
                  E-mail
                </label>
                <input
                  id="reg-email"
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
                <label htmlFor="reg-password" className="label-uppercase block mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
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
                <PasswordStrengthMeter password={password} className="mt-2" />
              </div>

              <div>
                <label htmlFor="reg-confirm" className="label-uppercase block mb-2">
                  Confirmar senha
                </label>
                <input
                  id="reg-confirm"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="field-input"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[11px] font-bold text-critical uppercase tracking-wider mt-1.5">
                    As senhas não coincidem.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="btn-primary"
              >
                {busy ? 'Criando conta...' : 'Criar conta'}
              </button>
            </form>
          )}

          <p className="text-center text-[11px] text-gray-400 mt-5">
            {mode === 'login'
              ? 'Ainda não tem conta? Use a aba acima para criar.'
              : 'Já tem conta? Use a aba "Entrar" para acessar.'}
          </p>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          FireCheck v1.0.0 · PWA Offline-First
        </p>
      </div>
    </div>
  );
}
