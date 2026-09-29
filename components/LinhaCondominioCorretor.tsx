import CondominioTag from './CondominioTag';
import CorretorSelo from './CorretorSelo';

type C = { nome: string; foto: string | null; creci: string | null };

// Linha de cima das informações do card: etiqueta do condomínio à esquerda e o
// corretor responsável (bolinha com foto, nome e CRECI) à direita. No celular,
// onde o card é estreito, o corretor aparece só pela bolinha (nome no toque longo).
export default function LinhaCondominioCorretor({ condominio, corretor }: { condominio?: string | null; corretor?: C | null }) {
  if (!condominio && !corretor?.nome) return null;
  return (
    <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
      <div className="min-w-0 flex-1">{condominio && <CondominioTag nome={condominio} />}</div>
      {corretor?.nome && (
        <div className="max-w-[48%] shrink-0" title={`${corretor.nome}${corretor.creci ? ` · CRECI ${corretor.creci}` : ''}`}>
          <CorretorSelo c={corretor} compactoNoCelular />
        </div>
      )}
    </div>
  );
}
