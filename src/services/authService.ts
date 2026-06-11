import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import type { Inspector, UserProfile } from '../types';

// ---------------------------------------------------------------------------
// Autenticação via Supabase Auth + tabela `public.profiles`.
//
// • A senha nunca toca o client além do input — Supabase faz hash + storage.
// • Sessão persistida em `localStorage['firecheck-auth']` (chave controlada
//   pelo cliente Supabase).
// • O `users` table do Dexie foi removido (Dexie v4) — a fonte da verdade
//   de identidade agora é o Supabase.
// • Recuperação de senha usa OTP por e-mail (6 dígitos), conforme decisão
//   do projeto: `signInWithOtp` → `verifyOtp` → `updateUser({ password })`.
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
  nome: string;
  cargo: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Validation (client-side; Supabase reforça no servidor)
// ---------------------------------------------------------------------------

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function checkPasswordPolicy(password: string): PasswordCheck {
  if (password.length < 8) {
    return { ok: false, reason: 'A senha deve ter pelo menos 8 caracteres.' };
  }
  if (!/[A-Za-zÀ-ÿ]/.test(password)) {
    return { ok: false, reason: 'A senha deve conter ao menos uma letra.' };
  }
  if (!/\d/.test(password)) {
    return { ok: false, reason: 'A senha deve conter ao menos um número.' };
  }
  return { ok: true };
}

export function isValidNome(nome: string): boolean {
  return nome.trim().length >= 3;
}

export function isValidCargo(cargo: string): boolean {
  return cargo.trim().length >= 2;
}

// ---------------------------------------------------------------------------
// Password strength meter (0..4) — reusado pela UI
// ---------------------------------------------------------------------------

export type StrengthScore = 0 | 1 | 2 | 3 | 4;
export type StrengthLabel =
  | 'Muito fraca'
  | 'Fraca'
  | 'Razoável'
  | 'Forte'
  | 'Muito forte';

export function getPasswordStrength(password: string): {
  score: StrengthScore;
  label: StrengthLabel;
} {
  if (!password) return { score: 0, label: 'Muito fraca' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const capped = Math.min(score, 4) as StrengthScore;
  const labels: StrengthLabel[] = [
    'Muito fraca',
    'Fraca',
    'Razoável',
    'Forte',
    'Muito forte',
  ];
  return { score: capped, label: labels[capped] };
}

// ---------------------------------------------------------------------------
// AuthError factory (erasableSyntaxOnly proíbe classes)
// ---------------------------------------------------------------------------

export type AuthErrorCode =
  | 'EMAIL_INVALID'
  | 'EMAIL_TAKEN'
  | 'PASSWORD_WEAK'
  | 'NOME_INVALID'
  | 'CARGO_INVALID'
  | 'CREDENTIALS_INVALID'
  | 'NETWORK'
  | 'NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'UNKNOWN';

export interface AuthError extends Error {
  code: AuthErrorCode;
}

export function authError(code: AuthErrorCode, message: string): AuthError {
  const err = new Error(message) as AuthError;
  err.code = code;
  err.name = 'AuthError';
  return err;
}

export function isAuthError(err: unknown): err is AuthError {
  return err instanceof Error && (err as AuthError).code !== undefined;
}

// ---------------------------------------------------------------------------
// Supabase error → AuthError mapping
// ---------------------------------------------------------------------------

function mapSupabaseError(err: SupabaseAuthError | { message: string }): AuthError {
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return authError('EMAIL_TAKEN', 'Já existe uma conta com este e-mail.');
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return authError('CREDENTIALS_INVALID', 'E-mail ou senha incorretos.');
  }
  if (msg.includes('email not confirmed')) {
    return authError(
      'CREDENTIALS_INVALID',
      'Confirme seu e-mail antes de entrar (verifique a caixa de entrada).',
    );
  }
  if (msg.includes('otp') && (msg.includes('expired') || msg.includes('invalid'))) {
    return msg.includes('expired')
      ? authError('OTP_EXPIRED', 'Código expirado. Solicite um novo.')
      : authError('OTP_INVALID', 'Código inválido. Verifique e tente novamente.');
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return authError(
      'RATE_LIMITED',
      'Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.',
    );
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return authError(
      'NETWORK',
      'Sem conexão com a nuvem. Verifique sua internet e tente novamente.',
    );
  }
  return authError('UNKNOWN', err.message || 'Erro desconhecido na autenticação.');
}

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------

function toInspector(profile: UserProfile): Inspector {
  return {
    id: profile.id,
    nome: profile.nome,
    cargo: profile.cargo,
    role: profile.role,
  };
}

async function fetchOwnProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getUser();
  const uid = sessionData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nome, cargo, role, created_at, updated_at')
    .eq('id', uid)
    .maybeSingle();
  if (error) {
    console.error('[auth] fetchOwnProfile:', error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    nome: data.nome,
    cargo: data.cargo,
    role: data.role as 'admin' | 'inspector',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Public API — Auth
// ---------------------------------------------------------------------------

export async function registerUser(input: RegisterInput): Promise<Inspector> {
  if (!supabase) {
    throw authError('NOT_CONFIGURED', 'Supabase não está configurado neste ambiente.');
  }
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw authError('EMAIL_INVALID', 'Informe um e-mail válido.');
  }
  if (!isValidNome(input.nome)) {
    throw authError('NOME_INVALID', 'Informe seu nome completo.');
  }
  if (!isValidCargo(input.cargo)) {
    throw authError('CARGO_INVALID', 'Informe seu cargo.');
  }
  const policy = checkPasswordPolicy(input.password);
  if (policy.ok === false) {
    throw authError('PASSWORD_WEAK', policy.reason);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { nome: input.nome.trim(), cargo: input.cargo.trim() },
    },
  });
  if (error) throw mapSupabaseError(error);
  if (!data.user) {
    throw authError('UNKNOWN', 'Cadastro não retornou um usuário.');
  }

  // Trigger `handle_new_user` cria a linha em `public.profiles`. Pode haver
  // um pequeno delay até o SELECT enxergar a linha; fazemos 1 retry rápido.
  let profile = await fetchOwnProfile();
  for (let attempt = 0; !profile && attempt < 3; attempt++) {
    await new Promise((r) => setTimeout(r, 250));
    profile = await fetchOwnProfile();
  }
  if (!profile) {
    // Fallback mínimo: monta Inspector a partir dos metadados do user.
    return {
      id: data.user.id,
      nome: input.nome.trim(),
      cargo: input.cargo.trim(),
      role: 'inspector',
    };
  }
  return toInspector(profile);
}

export async function loginUser(input: LoginInput): Promise<Inspector> {
  if (!supabase) {
    throw authError('NOT_CONFIGURED', 'Supabase não está configurado neste ambiente.');
  }
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw authError('EMAIL_INVALID', 'Informe um e-mail válido.');
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) throw mapSupabaseError(error);

  const profile = await fetchOwnProfile();
  if (!profile) {
    throw authError(
      'UNKNOWN',
      'Login efetuado, mas não foi possível carregar o perfil. Tente novamente.',
    );
  }
  return toInspector(profile);
}

export async function resolveSession(): Promise<Inspector | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const profile = await fetchOwnProfile();
  return profile ? toInspector(profile) : null;
}

export async function logoutUser(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// Password recovery (OTP by e-mail)
// ---------------------------------------------------------------------------

/** Etapa 1: envia código de 6 dígitos para o e-mail. */
export async function requestPasswordRecovery(email: string): Promise<void> {
  if (!supabase) {
    throw authError('NOT_CONFIGURED', 'Supabase não está configurado neste ambiente.');
  }
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw authError('EMAIL_INVALID', 'Informe um e-mail válido.');
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: false },
  });
  if (error) throw mapSupabaseError(error);
}

/** Etapa 2: verifica o código e devolve o e-mail em caso de sucesso. */
export async function verifyRecoveryOtp(
  email: string,
  token: string,
): Promise<{ email: string }> {
  if (!supabase) {
    throw authError('NOT_CONFIGURED', 'Supabase não está configurado neste ambiente.');
  }
  const normalized = normalizeEmail(email);
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalized,
    token: token.trim(),
    type: 'email',
  });
  if (error) throw mapSupabaseError(error);
  return { email: data.user?.email ?? normalized };
}

/** Etapa 3: redefine a senha do usuário logado (vínculo feito via OTP). */
export async function updateOwnPassword(newPassword: string): Promise<void> {
  if (!supabase) {
    throw authError('NOT_CONFIGURED', 'Supabase não está configurado neste ambiente.');
  }
  const policy = checkPasswordPolicy(newPassword);
  if (policy.ok === false) {
    throw authError('PASSWORD_WEAK', policy.reason);
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw mapSupabaseError(error);
}

// ---------------------------------------------------------------------------
// Admin: listar perfis
// ---------------------------------------------------------------------------

export interface PublicUser {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  role: 'admin' | 'inspector';
  createdAt: string;
}

export async function listUsers(): Promise<PublicUser[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nome, cargo, role, created_at')
    .order('nome', { ascending: true });
  if (error) {
    console.error('[auth] listUsers:', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    nome: row.nome,
    cargo: row.cargo,
    role: row.role as 'admin' | 'inspector',
    createdAt: row.created_at,
  }));
}

export async function setUserRole(
  id: string,
  role: 'admin' | 'inspector',
): Promise<void> {
  if (!supabase) {
    throw authError('NOT_CONFIGURED', 'Supabase não está configurado neste ambiente.');
  }
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) throw mapSupabaseError(error);
}

export async function deleteUser(id: string): Promise<void> {
  if (!supabase) {
    throw authError('NOT_CONFIGURED', 'Supabase não está configurado neste ambiente.');
  }
  // O client não tem permissão de `auth.admin.deleteUser`, então usamos a RPC
  // SECURITY DEFINER criada em 0003_supabase_auth.sql.
  const { error } = await supabase.rpc('admin_delete_user', { target_id: id });
  if (error) {
    throw authError(
      'UNKNOWN',
      error.message || 'Não foi possível excluir o usuário.',
    );
  }
}

export async function isSupabaseReady(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase!.auth.getSession();
    return !error;
  } catch {
    return false;
  }
}
