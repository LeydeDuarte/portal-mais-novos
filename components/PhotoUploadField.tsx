'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Props = {
  photos: string[]; // URLs públicas já salvas no R2 — a primeira é a capa
  onChange: (urls: string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  folder?: 'imoveis' | 'empreendimentos' | 'plantas';
  label?: string;
  // Plantas: fundo branco, imagem inteira (sem cortar) e um pouco mais de resolução
  modo?: 'fotos' | 'plantas';
  compacto?: boolean;
};

// Ctrl+V de print: com vários campos na tela (fotos + planta de cada tipologia),
// o print vai para o último campo que a pessoa tocou/passou o mouse. Se nenhum
// foi tocado, vai para o primeiro campo da página.
let campoAtivo: string | null = null;
const campos: string[] = [];
const ouvintes = new Set<(id: string | null) => void>();
function ativar(id: string) {
  campoAtivo = id;
  ouvintes.forEach((fn) => fn(id));
}

export function imagensDoEvento(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) out.push(f.name && f.name !== 'image.png' ? f : new File([f], `print-${Date.now()}.png`, { type: f.type }));
    }
  }
  if (!out.length) for (const f of Array.from(dt.files ?? [])) if (f.type.startsWith('image/')) out.push(f);
  return out;
}

const MAX_SIDE = 2000;
const MAX_SIDE_PLANTA = 2400;
const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024; // 30 MB por foto antes da compressão
const ACEITOS_DIRETO = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Reduz a foto no próprio navegador antes de enviar: fica mais rápido pra
// quem está cadastrando pelo celular e o site carrega mais leve pro cliente.
async function resizeImage(file: File, maxSide = MAX_SIDE): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#ffffff'; // PNG com fundo transparente não fica preto no JPG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', maxSide > MAX_SIDE ? 0.9 : 0.85));
  return blob ?? file;
}

export async function uploadOne(file: File, folder: string): Promise<string> {
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error(`"${file.name}" tem mais de 30 MB — reduza a foto antes de enviar.`);
  const converted = await resizeImage(file, folder === 'plantas' ? MAX_SIDE_PLANTA : MAX_SIDE);
  // Se o navegador não conseguiu abrir a foto (ex: HEIC do iPhone no Chrome/Windows),
  // ela volta sem converter — e só JPG, PNG e WEBP podem seguir.
  if (converted === file && !ACEITOS_DIRETO.has(file.type)) {
    throw new Error(`"${file.name}" está num formato que este navegador não abre (${file.type || 'desconhecido'}). Salve como JPG e envie de novo.`);
  }
  const body = new FormData();
  body.append('file', converted, file.name.replace(/\.\w+$/, '') + '.jpg');
  body.append('folder', folder);
  const res = await fetch('/api/upload', { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Falha ao enviar a foto.');
  return data.url as string;
}

export default function PhotoUploadField({ photos, onChange, onUploadingChange, folder = 'imoveis', label = 'Fotos do imóvel', modo = 'fotos', compacto = false }: Props) {
  const id = useId();
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const plantas = modo === 'plantas';

  const handleFiles = async (lista: File[]) => {
    const files = lista.filter((f) => f.type.startsWith('image/') || !f.type);
    if (!files.length) return;
    setError(null);
    setPending((n) => n + files.length);
    onUploadingChange?.(true);

    // Envia 3 por vez, mantendo a ordem em que as fotos foram escolhidas
    const results: (string | null)[] = new Array(files.length).fill(null);
    let next = 0;
    const falhas: string[] = [];
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        try {
          results[i] = await uploadOne(files[i], folder);
        } catch (err) {
          falhas.push(err instanceof Error && err.message ? err.message : `"${files[i].name}": falha ao enviar.`);
        } finally {
          setPending((n) => n - 1);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    const uploaded = results.filter((u): u is string => !!u);
    onChange([...photosRef.current, ...uploaded]);
    onUploadingChange?.(false);
    if (falhas.length) setError(`${falhas.length} foto(s) não foram enviadas: ${falhas.slice(0, 3).join(' ')}${falhas.length > 3 ? ' …' : ''}`);
  };

  const handleRef = useRef(handleFiles);
  handleRef.current = handleFiles;

  // Registra o campo para receber Ctrl+V (print da tela)
  useEffect(() => {
    campos.push(id);
    const ouvir = (a: string | null) => setAtivo(a === id);
    ouvintes.add(ouvir);
    const onPaste = (e: ClipboardEvent) => {
      const alvo = campoAtivo && campos.includes(campoAtivo) ? campoAtivo : campos[0];
      if (alvo !== id) return;
      const imgs = imagensDoEvento(e.clipboardData);
      if (!imgs.length) return;
      e.preventDefault();
      handleRef.current(imgs);
    };
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('paste', onPaste);
      ouvintes.delete(ouvir);
      const i = campos.indexOf(id);
      if (i >= 0) campos.splice(i, 1);
      if (campoAtivo === id) campoAtivo = null;
    };
  }, [id]);

  const remove = (url: string) => onChange(photos.filter((p) => p !== url));
  const makeCover = (url: string) => onChange([url, ...photos.filter((p) => p !== url)]);
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2" onPointerEnter={() => ativar(id)} onPointerDown={() => ativar(id)} onFocusCapture={() => ativar(id)}>
      <label className="text-xs font-semibold text-[var(--text-muted)]">{label}</label>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          ativar(id);
          handleFiles(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm transition-colors hover:bg-[var(--pill-bg)] ${compacto ? 'px-3 py-3' : 'px-4 py-5'} ${
          arrastando ? 'border-accent bg-[#fbf8ee]' : ativo ? 'border-accent' : 'border-[var(--border)]'
        }`}
      >
        <span className="font-semibold">{plantas ? '+ Adicionar planta' : '+ Adicionar fotos'}</span>
        <span className="text-xs text-[var(--text-faint)]">
          {compacto
            ? 'Clique, arraste ou cole um print (Ctrl+V)'
            : 'JPG, PNG, WEBP ou foto do celular — várias de uma vez (até 30 MB cada). Também dá para arrastar ou colar um print com Ctrl+V.'}
        </span>
        {ativo && <span className="text-[10px] font-bold uppercase tracking-wide text-accent">Ctrl+V cola aqui</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          handleFiles(files);
        }}
        className="hidden"
      />

      {pending > 0 && <span className="text-xs font-semibold text-accent">Enviando {pending} foto(s)… aguarde antes de publicar.</span>}
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}

      {photos.length > 0 && (
        <>
          <span className="text-xs text-[var(--text-faint)]">
            {plantas
              ? `${photos.length} planta(s) — use as setas para mudar a ordem.`
              : `${photos.length} foto(s). A primeira é a capa do anúncio — use as setas para mudar a ordem da galeria.`}
          </span>
          <div className={`grid gap-2 ${compacto ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'}`}>
            {photos.map((url, i) => (
              <div key={url} className={`group relative aspect-square overflow-hidden rounded-lg ${plantas ? 'border border-[var(--border)] bg-white' : 'bg-[var(--card-img-bg)]'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${plantas ? 'Planta' : 'Foto'} ${i + 1}`} className={`h-full w-full ${plantas ? 'object-contain p-1' : 'object-cover'}`} loading="lazy" />
                {i === 0 && !plantas && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">Capa</span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-1.5 py-1 text-[11px] font-semibold text-white">
                  <div className="flex gap-1">
                    <button type="button" aria-label="Mover para antes" onClick={() => move(i, -1)} className="px-1 hover:text-accent disabled:opacity-30" disabled={i === 0}>
                      ←
                    </button>
                    <button type="button" aria-label="Mover para depois" onClick={() => move(i, 1)} className="px-1 hover:text-accent disabled:opacity-30" disabled={i === photos.length - 1}>
                      →
                    </button>
                  </div>
                  {i !== 0 && !plantas && (
                    <button type="button" onClick={() => makeCover(url)} className="hover:text-accent">
                      Capa
                    </button>
                  )}
                  <button type="button" aria-label="Remover foto" onClick={() => remove(url)} className="px-1 hover:text-red-300">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
