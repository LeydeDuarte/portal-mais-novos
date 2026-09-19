'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import ChipSelect from '@/components/ChipSelect';
import AmenitiesCheckboxes from '@/components/AmenitiesCheckboxes';
import PhotoUploadField from '@/components/PhotoUploadField';
import { useStaffSession } from '@/lib/use-staff-session';
import { useCreatedProperties } from '@/lib/use-created-properties';
import { extractFieldsFromText } from '@/lib/ai-extraction';
import { generateTitle } from '@/lib/title-generator';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { maskCurrencyInput, appendSuffix } from '@/lib/currency';
import type { PropertyDetail } from '@/lib/property-details';

const inputClass = 'rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none';
const NUM_OPCOES = ['1', '2', '3', '4', '5+'];

export default function CadastroIAPage() {
  const { staff, loaded } = useStaffSession();
  const { add } = useCreatedProperties();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  const [rawText, setRawText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: '',
    tipoUnidade: 'apartamento' as TipoUnidade,
    finalidade: 'venda' as 'venda' | 'aluguel',
    deliveryDate: '',
    priceDigits: '',
    priceSuffix: '' as '' | '/mês',
    location: '',
    quartos: '',
    vagas: '',
    banheiros: '',
    area: '',
    aceitaTemporada: false,
    description: '',
    amenities: [] as string[],
    photoNames: [] as string[]
  });

  if (!loaded || !staff) return null;

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleProcess = (e: FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    // Simula a latência de uma chamada de IA real (extração + fila
    // assíncrona, ver documento de arquitetura). Aqui é reconhecimento de
    // padrão local — instantâneo de verdade, o atraso é só pra não passar a
    // falsa impressão de que isso já é uma IA generativa de verdade.
    setTimeout(() => {
      const extracted = extractFieldsFromText(rawText);
      const tipoUnidade = extracted.tipoUnidade ?? form.tipoUnidade;
      const finalidade = extracted.finalidade ?? form.finalidade;
      const location = extracted.location ?? form.location;
      setForm((prev) => ({
        ...prev,
        titulo: generateTitle({ tipoUnidade, finalidade, location, quartos: extracted.quartos }),
        tipoUnidade: extracted.tipoUnidade ?? prev.tipoUnidade,
        finalidade: extracted.finalidade ?? prev.finalidade,
        priceDigits: extracted.price ?? prev.priceDigits,
        location: extracted.location ?? prev.location,
        quartos: extracted.quartos ?? prev.quartos,
        vagas: extracted.vagas ?? prev.vagas,
        banheiros: extracted.banheiros ?? prev.banheiros,
        area: extracted.area ?? prev.area,
        aceitaTemporada: extracted.aceitaTemporada ?? prev.aceitaTemporada,
        amenities: extracted.amenities ?? prev.amenities,
        description: rawText.slice(0, 400)
      }));
      setProcessing(false);
      setReviewing(true);
    }, 1200);
  };

  const handlePublish = (e: FormEvent) => {
    e.preventDefault();
    const id = `ia-${Date.now()}`;
    const priceFormatted = form.priceDigits.startsWith('R$')
      ? form.priceDigits
      : appendSuffix(maskCurrencyInput(form.priceDigits), form.finalidade === 'aluguel' ? form.priceSuffix : '');

    const property: PropertyDetail = {
      id,
      titulo: form.titulo || undefined,
      tipoUnidade: form.tipoUnidade,
      finalidade: form.finalidade,
      deliveryDate: form.deliveryDate || new Date().toISOString().slice(0, 7),
      price: priceFormatted,
      location: form.location || 'Goiânia — GO',
      beds: `${form.quartos || '?'} qts`,
      parking: `${form.vagas || '?'} vg`,
      banheiros: form.banheiros ? `${form.banheiros} banheiros` : undefined,
      area: `${form.area || '?'} m²`,
      height: 240 + Math.floor(Math.random() * 100),
      video: false,
      aceitaTemporada: form.aceitaTemporada,
      matchScore: 50,
      description: form.description || `Imóvel ${form.finalidade === 'aluguel' ? 'disponível para locação' : 'à venda'} em ${form.location}.`,
      amenities: form.amenities,
      corretorEmail: staff!.email
    };

    add(property);
    setSuccess(id);
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
      <PainelNav />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
          <h1 className="font-serif text-2xl font-semibold">Imóvel publicado!</h1>
          <p className="text-sm text-[var(--text-muted)]">Cadastrado a partir do texto, com sua revisão antes de publicar.</p>
          <div className="flex gap-3">
            <a href={`/imovel/${success}`} className="rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">
              Ver o imóvel
            </a>
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                setReviewing(false);
                setRawText('');
              }}
              className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)]"
            >
              Cadastrar outro
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PainelNav />
      <main className="mx-auto w-full max-w-xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Cadastro assistido por IA</h1>
        <p className="mt-1 mb-6 text-sm text-[var(--text-muted)]">
          Protótipo: cole o texto do anúncio ou da tabela — o reconhecimento de padrão tenta preencher os campos, mas{' '}
          <strong>você sempre revisa antes de publicar</strong>. Upload de PDF/fotos e a extração por IA de verdade entram
          numa fase seguinte (precisa de uma API de IA conectada).
        </p>

        {!reviewing ? (
          <form onSubmit={handleProcess} className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Cole aqui o texto do anúncio</label>
            <textarea
              required
              rows={10}
              className={inputClass}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={'Ex: Apartamento 3 quartos, 2 vagas, 2 banheiros, 98 m², Setor Bueno, Goiânia — GO. R$ 890.000. Piscina, academia, portaria 24h.'}
            />
            <button
              type="submit"
              disabled={processing}
              className="mt-2 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {processing ? 'Processando…' : 'Processar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePublish} className="flex flex-col gap-3">
            <div className="rounded-lg bg-[var(--pill-bg)] p-3 text-xs text-[var(--text-muted)]">
              Rascunho pré-preenchido — confira e ajuste antes de publicar. Campos que o reconhecimento não achou ficaram em branco.
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Título do anúncio (gerado automaticamente — pode editar)</label>
              <input className={inputClass} value={form.titulo} onChange={(e) => update('titulo', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Tipo de imóvel</label>
                <select className={inputClass} value={form.tipoUnidade} onChange={(e) => update('tipoUnidade', e.target.value as TipoUnidade)}>
                  {TIPO_UNIDADE_GRUPOS.map((grupo) => (
                    <optgroup key={grupo.label} label={grupo.label}>
                      {grupo.tipos.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {TIPO_UNIDADE_LABEL[tipo]}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Finalidade</label>
                <select className={inputClass} value={form.finalidade} onChange={(e) => update('finalidade', e.target.value as 'venda' | 'aluguel')}>
                  <option value="venda">Venda</option>
                  <option value="aluguel">Aluguel</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Data de entrega</label>
              <input type="month" required className={inputClass} value={form.deliveryDate} onChange={(e) => update('deliveryDate', e.target.value)} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Preço (confira — o reconhecimento pode errar)</label>
              <input required className={inputClass} value={form.priceDigits} onChange={(e) => update('priceDigits', e.target.value)} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Localização</label>
              <input required className={inputClass} value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Bairro, Goiânia — GO" />
            </div>

            <ChipSelect label="Quartos" options={NUM_OPCOES} value={form.quartos} onChange={(v) => update('quartos', v)} />
            <ChipSelect label="Vagas de garagem" options={NUM_OPCOES} value={form.vagas} onChange={(v) => update('vagas', v)} />
            <ChipSelect label="Banheiros" options={NUM_OPCOES} value={form.banheiros} onChange={(v) => update('banheiros', v)} />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Área (m²)</label>
              <input required type="number" className={inputClass} value={form.area} onChange={(e) => update('area', e.target.value)} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Descrição</label>
              <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Comodidades</label>
              <AmenitiesCheckboxes selected={form.amenities} onChange={(v) => update('amenities', v)} />
            </div>

            <PhotoUploadField
              label="Fotos (a IA vai poder extrair do PDF nesta etapa, quando conectada)"
              fileNames={form.photoNames}
              onChange={(v) => update('photoNames', v)}
            />

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.aceitaTemporada} onChange={(e) => update('aceitaTemporada', e.target.checked)} />
              Aceita temporada
            </label>

            <div className="mt-2 flex gap-3">
              <button type="submit" className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
                Publicar imóvel
              </button>
              <button
                type="button"
                onClick={() => setReviewing(false)}
                className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)]"
              >
                Voltar ao texto
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
