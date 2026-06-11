import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, KeyRound, ArrowLeft, Eye, EyeOff, CheckCircle2, RotateCcw } from 'lucide-react';
import { showToast } from '../../hooks/useToasts';
import {
  isAuthError,
  requestPasswordRecovery,
  updateOwnPassword,
  verifyRecoveryOtp,
  checkPasswordPolicy,
} from '../../services/authService';
import { isSupabaseConfigured } from '../../lib/supabase';
import PasswordStrengthMeter from '../../components/PasswordStrengthMeter';

const RECOVERY_EMAIL_KEY = 'firecheck-recovery-email';

type Step = 'otp' | 'password';

const OTP_LENGTH = 6;

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [email] = useState(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(RECOVERY_EMAIL_KEY) ?? '';
  });
  const [step, setStep] = useState<Step>('otp');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!email) {
      void navigate('/recuperar-senha', { replace: true });
    }
  }, [email, navigate]);

  const otp = otpDigits.join('');

  const setOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < text.length; i++) next[i] = text[i] ?? '';
    setOtpDigits(next);
    const focusIndex = Math.min(text.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      showToast({ kind: 'warning', title: `Digite os ${OTP_LENGTH} dígitos do código.` });
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
      await verifyRecoveryOtp(email, otp);
      showToast({
        kind: 'success',
        title: 'Código verificado!',
        description: 'Agora defina sua nova senha.',
      });
      setStep('password');
    } catch (err) {
      if (isAuthError(err)) {
        showToast({ kind: 'error', title: err.message });
      } else {
        console.error('[auth]', err);
        showToast({ kind: 'error', title: 'Não foi possível verificar o código.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      showToast({ kind: 'warning', title: 'Preencha a nova senha.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ kind: 'warning', title: 'As senhas não coincidem.' });
      return;
    }
    const policy = checkPasswordPolicy(newPassword);
    if (policy.ok === false) {
      showToast({ kind: 'error', title: policy.reason });
      return;
    }
    setSubmitting(true);
    try {
      await updateOwnPassword(newPassword);
      showToast({
        kind: 'success',
        title: 'Senha redefinida!',
        description: 'Você já pode entrar com a nova senha.',
      });
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(RECOVERY_EMAIL_KEY);
      }
      void navigate('/login', { replace: true });
    } catch (err) {
      if (isAuthError(err)) {
        showToast({ kind: 'error', title: err.message });
      } else {
        console.error('[auth]', err);
        showToast({ kind: 'error', title: 'Não foi possível redefinir a senha.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await requestPasswordRecovery(email);
      showToast({
        kind: 'success',
        title: 'Código reenviado!',
        description: 'Verifique sua caixa de entrada.',
      });
    } catch (err) {
      if (isAuthError(err)) {
        showToast({ kind: 'error', title: err.message });
      } else {
        showToast({ kind: 'error', title: 'Não foi possível reenviar o código.' });
      }
    } finally {
      setResending(false);
    }
  };

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
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-base font-black text-gray-900 uppercase tracking-wide">
              {step === 'otp' ? 'Verificar código' : 'Definir nova senha'}
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            {step === 'otp' ? (
              <>
                Enviamos um código de {OTP_LENGTH} dígitos para{' '}
                <span className="font-bold text-gray-700">{email}</span>. Digite-o
                abaixo para continuar.
              </>
            ) : (
              'Sua identidade foi confirmada. Agora escolha uma senha forte.'
            )}
          </p>

          {step === 'otp' ? (
            <form className="space-y-5" onSubmit={handleVerify} noValidate>
              <div>
                <label className="label-uppercase block mb-2">
                  Código de verificação
                </label>
                <div
                  className="flex gap-2 justify-between"
                  onPaste={handleOtpPaste}
                >
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => setOtpDigit(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      aria-label={`Dígito ${index + 1}`}
                      className="field-input text-center text-xl font-black w-full h-14 px-0"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? 'Verificando...' : 'Verificar código'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gray-500 hover:text-primary disabled:opacity-50"
                >
                  <RotateCcw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'Reenviando...' : 'Reenviar código'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleUpdatePassword} noValidate>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-success">
                <CheckCircle2 className="w-4 h-4" />
                Código verificado
              </div>

              <div>
                <label htmlFor="new-password" className="label-uppercase block mb-2">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                <PasswordStrengthMeter password={newPassword} className="mt-2" />
              </div>

              <div>
                <label htmlFor="confirm-password" className="label-uppercase block mb-2">
                  Confirmar nova senha
                </label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="field-input"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] font-bold text-critical uppercase tracking-wider mt-1.5">
                    As senhas não coincidem.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}
        </div>

        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 mt-6 hover:text-gray-600"
        >
          <ArrowLeft className="w-3 h-3" />
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
