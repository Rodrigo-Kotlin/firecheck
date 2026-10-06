import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-neutralBg flex items-center justify-center px-4 py-8">
      <section className="card-subtle bg-white max-w-md w-full text-center space-y-4">
        <p className="label-uppercase">Erro de navegação</p>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">Página não encontrada</h1>
        <p className="text-sm text-gray-500">O endereço informado não corresponde a uma página disponível.</p>
        <Link to="/" replace className="btn-primary inline-flex w-auto">Voltar ao Dashboard</Link>
      </section>
    </main>
  );
}
