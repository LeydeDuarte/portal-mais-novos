'use client';

import { useRef, useState } from 'react';

type Props = {
  photos: string[]; // URLs públicas já salvas no R2 — a primeira é a capa
  onChange: (urls: string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  folder?: 'imoveis' | 'empreendimentos';
  label?: string;
};

const MAX_SIDE = 2000;

// Reduz a foto no próprio navegador antes de enviar: fica mais rápido pra
// quem está cadastrando pelo celular e o site carrega mais leve pro cliente.
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  return blob ?? file;
}

async function uploadOne(file: File, folder: string): Promise<string> {
  const body = new FormData();
  body.append('file', await resizeImage(file), file.name.replace(/\.\w+$/, '') + '.jpg');
  body.append('folder', folder);
  const res = await fetch('/api/upload', { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Falha ao enviar a foto.');
  return data.url as string;
}

export default function PhotoUploadField({ photos, onChange, onUploadingChange, folder = 'imoveis', label = 'Fotos do imóvel' }: Props) {
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!files.length) return;
    setError(null);
    setPending((n) => n + files.length);
    onUploadingChange?.(true);

    // Envia 3 por vez, mantendo a ordem em que as fotos foram escolhidas
    const results: (string | null)[] = new Array(files.length).fill(null);
    let next = 0;
    let failures = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        try {
          results[i] = await uploadOne(files[i], folder);
        } catch (err) {
          failures++;
          setError(err instanceof Error ? err.message : 'Falha ao enviar a foto.');
        } finally {
          setPending((n) => n - 1);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    const uploaded = results.filter((u): u is string => !!u);
    onChange([...photosRef.current, ...uploaded]);
    onUploadingChange?.(false);
    if (failures) setError(`${failures} foto(s) não foram enviadas. Tente de novo só com elas.`);
  };

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
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-[var(--text-muted)]">{label}</label>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-sm hover:bg-[var(--pill-bg)]"
      >
        <span className="font-semibold">+ Adicionar fotos</span>
        <span className="text-xs text-[var(--text-faint)]">JPG, PNG ou WEBP — pode escolher várias de uma vez</span>
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} className="hidden" />

      {pending > 0 && <span className="text-xs font-semibold text-accent">Enviando {pending} foto(s)… aguarde antes de publicar.</span>}
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}

      {photos.length > 0 && (
        <>
          <span className="text-xs text-[var(--text-faint)]">
            {photos.length} foto(s). A primeira é a capa do anúncio — use as setas para mudar a ordem da galeria.
          </span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((url, i) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-lg bg-[var(--card-img-bg)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                {i === 0 && (
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
                  {i !== 0 && (
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
