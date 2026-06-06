import { db } from '../db';
import type { Inspector, UserAccount } from '../types';

// ---------------------------------------------------------------------------
// Local-first authentication
//
// Passwords are hashed with PBKDF2-SHA-256 (Web Crypto API, no dependencies).
// Hash + salt are stored in Dexie's `users` table. The current session is
// tracked by an opaque user id in localStorage; the full account record is
// never persisted outside the encrypted-at-rest IndexedDB.
//
// If/when Supabase auth is wired in, swap the bodies of `registerUser`,
// `loginUser` and `clearSession` for calls to `supabase.auth.*` — the rest
// of the app depends only on the shapes returned here.
// ---------------------------------------------------------------------------

const SESSION_KEY = 'firecheck-auth-session';
const PBKDF2_ITERATIONS = 100_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;

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

/** Result of a password check. `ok: true` for valid, otherwise explain. */
export type PasswordCheck = { ok: true } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Validation
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
// Password strength meter (0..4)
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
// Cryptographic primitives
// ---------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function generateSalt(): string {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return bytesToHex(salt);
}

async function deriveHash(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    HASH_BITS,
  );
  return bytesToHex(new Uint8Array(bits));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Session (localStorage)
// ---------------------------------------------------------------------------

interface SessionRef {
  userId: string;
  email: string;
  savedAt: number;
}

function readSession(): SessionRef | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionRef;
    if (typeof parsed.userId === 'string' && typeof parsed.email === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeSession(ref: SessionRef): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(ref));
}

function clearLocalSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

function toInspector(account: UserAccount): Inspector {
  return { id: account.id, nome: account.nome, cargo: account.cargo, role: account.role };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AuthErrorCode =
  | 'EMAIL_INVALID'
  | 'EMAIL_TAKEN'
  | 'PASSWORD_WEAK'
  | 'NOME_INVALID'
  | 'CARGO_INVALID'
  | 'CREDENTIALS_INVALID'
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

export async function registerUser(input: RegisterInput): Promise<Inspector> {
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
  if (!policy.ok) {
    throw authError('PASSWORD_WEAK', policy.reason);
  }

  const existing = await db.users.where('email').equals(email).first();
  if (existing) {
    throw authError(
      'EMAIL_TAKEN',
      'Já existe uma conta com este e-mail. Faça login.',
    );
  }

  const now = new Date().toISOString();
  const salt = generateSalt();
  const passwordHash = await deriveHash(input.password, salt);
  // First registered account on the device is promoted to admin so the
  // PWA always has a privileged user; subsequent users join as inspectors.
  const userCount = await db.users.count();
  const role: UserAccount['role'] = userCount === 0 ? 'admin' : 'inspector';
  const account: UserAccount = {
    id: crypto.randomUUID(),
    email,
    nome: input.nome.trim(),
    cargo: input.cargo.trim(),
    role,
    passwordHash,
    salt,
    createdAt: now,
    updatedAt: now,
  };

  await db.users.add(account);
  writeSession({ userId: account.id, email: account.email, savedAt: Date.now() });
  return toInspector(account);
}

export async function loginUser(input: LoginInput): Promise<Inspector> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw authError('EMAIL_INVALID', 'Informe um e-mail válido.');
  }
  const policy = checkPasswordPolicy(input.password);
  if (!policy.ok) {
    throw authError('PASSWORD_WEAK', policy.reason);
  }

  const account = await db.users.where('email').equals(email).first();
  if (!account) {
    throw authError(
      'CREDENTIALS_INVALID',
      'E-mail ou senha incorretos.',
    );
  }
  const candidate = await deriveHash(input.password, account.salt);
  if (!constantTimeEqual(candidate, account.passwordHash)) {
    throw authError(
      'CREDENTIALS_INVALID',
      'E-mail ou senha incorretos.',
    );
  }
  writeSession({ userId: account.id, email: account.email, savedAt: Date.now() });
  return toInspector(account);
}

/**
 * Resolves the currently logged-in user. Returns `null` if no session, or if
 * the session points to a record that no longer exists in the local DB
 * (orphan — happens after the mock-login migration).
 */
export async function resolveSession(): Promise<Inspector | null> {
  const ref = readSession();
  if (!ref) return null;
  const account = await db.users.get(ref.userId);
  if (!account) {
    clearLocalSession();
    return null;
  }
  return toInspector(account);
}

export async function logoutUser(): Promise<void> {
  clearLocalSession();
}

export async function listUsersCount(): Promise<number> {
  return db.users.count();
}

// ---------------------------------------------------------------------------
// Admin operations
// ---------------------------------------------------------------------------

/** Public-facing user record (no password material). */
export interface PublicUser {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  role: UserAccount['role'];
  createdAt: string;
}

function toPublic(account: UserAccount): PublicUser {
  return {
    id: account.id,
    email: account.email,
    nome: account.nome,
    cargo: account.cargo,
    role: account.role,
    createdAt: account.createdAt,
  };
}

export async function listUsers(): Promise<PublicUser[]> {
  const all = await db.users.toArray();
  return all
    .map(toPublic)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function getPublicUser(id: string): Promise<PublicUser | null> {
  const account = await db.users.get(id);
  return account ? toPublic(account) : null;
}

export async function setUserRole(
  id: string,
  role: UserAccount['role'],
): Promise<void> {
  const account = await db.users.get(id);
  if (!account) return;
  await db.users.put({ ...account, role, updatedAt: new Date().toISOString() });
}

export async function deleteUser(id: string): Promise<void> {
  await db.users.delete(id);
  const ref = readSession();
  if (ref?.userId === id) {
    clearLocalSession();
  }
}

export async function isFirstUserAdmin(): Promise<boolean> {
  const all = await db.users.toArray();
  if (all.length === 0) return true;
  return all.some((u) => u.role === 'admin');
}
