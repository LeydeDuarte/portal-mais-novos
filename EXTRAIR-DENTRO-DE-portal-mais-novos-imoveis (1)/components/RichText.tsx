import { parseDescricao, type Inline } from '@/lib/text';

function Inlines({ itens }: { itens: Inline[] }) {
  return (
    <>
      {itens.map((i, k) =>
        i.bold ? (
          <strong key={k} className="font-semibold text-[var(--text)]">
            {i.text}
          </strong>
        ) : i.italic ? (
          <em key={k}>{i.text}</em>
        ) : (
          <span key={k}>{i.text}</span>
        )
      )}
    </>
  );
}

// Descrição formatada sempre no padrão do site (mesmas fontes, tamanhos e
// espaçamentos), não importa como foi digitada no cadastro.
export default function RichText({ texto }: { texto?: string | null }) {
  const blocos = parseDescricao(texto);
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-[var(--text-muted)]">
      {blocos.map((b, i) =>
        b.tipo === 'titulo' ? (
          <h3 key={i} className="mt-2 font-serif text-lg font-semibold text-[var(--text)]">
            <Inlines itens={b.texto} />
          </h3>
        ) : b.tipo === 'lista' ? (
          <ul key={i} className="flex flex-col gap-1.5 pl-1">
            {b.itens.map((item, k) => (
              <li key={k} className="flex gap-2">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>
                  <Inlines itens={item} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Inlines itens={b.texto} />
          </p>
        )
      )}
    </div>
  );
}
