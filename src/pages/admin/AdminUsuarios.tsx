import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { ChevronLeft, Shield, User, Search, Trash2, AlertTriangle } from 'lucide-react';
import { isAdmin } from '../../services/permissions';
import { showToast } from '../../hooks/useToasts';

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const { user, users, usersLoading, loadUsers, setUserRole, deleteUserAccount } = useAppStore();
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin(user)) {
      void navigate('/', { replace: true });
      return;
    }
    void loadUsers();
  }, [user, navigate, loadUsers]);

  if (!isAdmin(user)) return null;

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      u.nome.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.cargo.toLowerCase().includes(term)
    );
  });

  const handleToggleRole = async (id: string, current: 'admin' | 'inspector') => {
    const next = current === 'admin' ? 'inspector' : 'admin';
    if (id === user?.id && next === 'inspector') {
      showToast({
        kind: 'warning',
        title: 'Você não pode remover o próprio acesso de administrador.',
      });
      return;
    }
    try {
      await setUserRole(id, next);
      showToast({ kind: 'success', title: `Papel atualizado: ${next === 'admin' ? 'Administrador' : 'Inspetor'}.` });
    } catch (err) {
      console.error(err);
      showToast({ kind: 'error', title: 'Não foi possível atualizar o papel.' });
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (id === user?.id) {
      showToast({
        kind: 'warning',
        title: 'Você não pode excluir a própria conta por aqui.',
      });
      setConfirmDelete(null);
      return;
    }
    try {
      await deleteUserAccount(id);
      showToast({ kind: 'success', title: `Usuário "${nome}" removido.` });
      setConfirmDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir.';
      showToast({ kind: 'error', title: message });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      <header className="page-header">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Administração</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary flex-shrink-0" />
            Usuários do Sistema
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
            {users.length} {users.length === 1 ? 'conta' : 'contas'} cadastrada{users.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      <div className="relative" role="search">
        <label htmlFor="users-search" className="sr-only">
          Buscar usuários
        </label>
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400" aria-hidden="true">
          <Search className="w-4 h-4" />
        </span>
        <input
          id="users-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou cargo..."
          className="field-input pl-11"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label="Limpar busca"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>

      {usersLoading ? (
        <div className="card-subtle bg-white flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-subtle bg-white text-center py-12 space-y-2">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <User className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => {
            const initials = u.nome
              .split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
            const isSelf = u.id === user?.id;
            const isConfirming = confirmDelete === u.id;
            return (
              <div key={u.id} className="card-subtle bg-white space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-sm flex-shrink-0 ${
                    u.role === 'admin' ? 'bg-primary' : 'bg-gray-400'
                  }`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-black text-gray-900 truncate">{u.nome}</h3>
                      {u.role === 'admin' && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-white flex-shrink-0">
                          Admin
                        </span>
                      )}
                      {isSelf && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 flex-shrink-0">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                      {u.cargo} · desde {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                  <button
                    type="button"
                    onClick={() => void handleToggleRole(u.id, u.role)}
                    className={`btn-ghost btn-sm btn-auto flex-1 min-w-[140px] ${
                      u.role === 'admin'
                        ? 'text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/40 hover:text-primary'
                        : ''
                    }`}
                  >
                    {u.role === 'admin' ? 'Rebaixar para Inspetor' : 'Promover a Admin'}
                  </button>
                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(isConfirming ? null : u.id)}
                      className={`btn-sm btn-auto inline-flex items-center gap-1.5 ${
                        isConfirming
                          ? 'bg-critical text-white border border-critical hover:bg-critical'
                          : 'btn-ghost text-gray-400 hover:!text-critical hover:!border-critical/40 hover:!bg-red-50'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      {isConfirming ? 'Confirmar?' : 'Excluir'}
                    </button>
                  )}
                </div>

                {isConfirming && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-critical text-[11px] font-medium rounded-lg p-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      Esta ação remove permanentemente o usuário e invalida sessões ativas. Registros já criados por ele permanecem no inventário.
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(u.id, u.nome)}
                      className="h-8 px-3 bg-critical text-white rounded-md text-[10px] font-black uppercase tracking-wider hover:bg-red-700"
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
