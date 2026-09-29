import Link from 'next/link';
import { PAPEL_LABEL, empresaAtiva, nomeEmpresa, type ConcepcaoItem } from '@/lib/empresas-tipos';

// "Concepção": construtoras e incorporadoras do empreendimento, com link para o perfil
// informativo de cada uma. Empresa que não está ATIVA na Receita aparece em cinza.
export default function ConcepcaoBloco({ itens }: { itens: ConcepcaoItem[] }) {
  if (!itens.length) return null;
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">Concepção</span>
      <div className="flex flex-wrap gap-2">
        {itens.map(({ empresa, papel }) => (
          <Link
            key={empresa.id}
            href={`/empresa/${empresa.slug}`}
            className="flex flex-col rounded-xl border border-[var(--border)] px-3.5 py-2 hover:border-accent"
          >
            <span className={`text-sm font-bold ${empresaAtiva(empresa) ? '' : 'text-[var(--text-faint)]'}`}>{nomeEmpresa(empresa)}</span>
            <span className="text-[11px] text-[var(--text-muted)]">{PAPEL_LABEL[papel]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
