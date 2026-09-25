'use client';

export default function VideoFormato({ vertical, onChange }: { vertical: boolean | null; onChange: (v: boolean) => void }) {
  const opt = (v: boolean, titulo: string, sub: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={`flex flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${vertical === v ? 'border-ink bg-[var(--pill-bg)]' : 'border-[var(--border)]'}`}
    >
      <span className={`shrink-0 rounded-[3px] border-2 ${vertical === v ? 'border-ink' : 'border-[var(--text-faint)]'}`} style={v ? { width: 14, height: 24 } : { width: 26, height: 15 }} />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="text-xs text-[var(--text-faint)]">{sub}</span>
      </span>
    </button>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-xs font-semibold ${vertical === null ? 'text-red-600' : 'text-[var(--text-muted)]'}`}>
        Formato do vídeo {vertical === null ? 'obrigatório: escolha antes de publicar' : ''}
      </span>
      <div className="flex gap-2">
        {opt(false, 'Deitado', 'Horizontal, 16:9')}
        {opt(true, 'Em pé', 'Gravado no celular, Reels/Shorts')}
      </div>
      <span className="text-xs text-[var(--text-faint)]">
        Marque como o vídeo foi GRAVADO, não como aparece no YouTube. Vídeos longos gravados em pé aparecem deitados no YouTube, com faixas pretas, marcando
        &quot;Em pé&quot;, ele preenche o espaço da foto principal sem sobrar preto.
      </span>
    </div>
  );
}

// Links de Shorts e de Reels/Instagram são sempre em pé
export function pareceVertical(url: string): boolean {
  return /youtube\.com\/shorts\//i.test(url) || /instagram\.com\/(reel|reels|p)\//i.test(url);
}
