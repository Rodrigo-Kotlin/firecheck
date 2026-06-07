import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { showToast } from '../../hooks/useToasts';
import { isAuthError, requestPasswordRecovery } from '../../services/authService';
import { isSupabaseConfigured } from '../../lib/supabase';

const RECOVERY_EMAIL_KEY = 'firecheck-recovery-email';

export default function RecuperarSenha() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(RECOVERY_EMAIL_KEY) ?? '';
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast({ kind: 'warning', title: 'Informe seu e-mail.' });
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
      await requestPasswordRecovery(email);
      localStorage.setItem(RECOVERY_EMAIL_KEY, email.trim().toLowerCase());
      showToast({
        kind: 'success',
        title: 'Código enviado!',
        description: 'Verifique sua caixa de entrada (e o spam).',
      });
      void navigate('/redefinir-senha', { replace: true });
    } catch (err) {
      if (isAuthError(err)) {
        showToast({ kind: 'error', title: err.message });
      } else {
        console.error('[auth]', err);
        showToast({
          kind: 'error',
          title: 'Não foi possível enviar o código.',
          description: 'Tente novamente em alguns instantes.',
        });
      }
    } finally {
      setSubmitting(false);
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
              Recuperar senha
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            Informe o e-mail cadastrado. Enviaremos um código de 6 dígitos para
            você definir uma nova senha.
          </p>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="recovery-email" className="label-uppercase block mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@firecheck.com"
                  className="field-input pl-11"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Enviando...' : 'Enviar código'}
            </button>
          </form>
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
