'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useStaffSession } from '@/lib/use-staff-session';
import { useCreatedProperties } from '@/lib/use-created-properties';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import type { PropertyDetail } from '@/lib/property-details';

const inputClass = 'rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none';

export default function NovoImovelPage() {
  const { staff, loaded } = useStaffSession();
  const { add } = useCreatedProperties();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  const [form, setForm] = useState({
    tipoUnidade: 'apartamento' as TipoUnidade,
    finalidade: 'venda' as 'venda' | 'aluguel',
    deliveryDate: '',
    price: '',
    location: '',
    beds: '',
    parking: '',
    area: '',
    aceitaTemporada: false,
    video: false,
    description: '',
    amenities: ''
  });
  const [success, setSuccess] = useState<string | null>(null);

  if (!loaded || !staff) return null;

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const id = `manual-${Date.now()}`;
    const property: PropertyDetail = {
      id,
      tipoUnidade: form.tipoUnidade,
      finalidade: form.finalidade,
      deliveryDate: form.deliveryDate || new Date().toISOString().slice(0, 7),
      price: form.price,
      location: form.location,
      beds: form.beds,
      parking: form.parking,
      area: form.area,
      height: 240 + Math.floor(Math.random() * 100),
      video: form.video,
      aceitaTemporada: form.aceitaTemporada,
      matchScore: 50,
      description: form.description || `Imóvel ${form.finalidade === 'aluguel' ? 'disponível para locação' : 'à venda'} em ${form.location}.`,
      amenities: form.amenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      corretorEmail: staff.email
    };

    add(property);
    setSuccess(id);
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
          <h1 className="font-serif text-2xl font-semibold">Imóvel cadastrado!</h1>
          <p className="text-sm text-[var(--text-muted)]">Já está publicado — aparece no feed do Comprar e tem página própria.</p>
          <div className="flex gap-3">
            <a href={`/imovel/${success}`} className="rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">
              Ver o imóvel
            </a>
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                setForm({ ...form, price: '', location: '', beds: '', parking: '', area: '', description: '', amenities: '' });
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
      <main className="mx-auto w-full max-w-xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Cadastrar imóvel</h1>
        <p className="mt-1 mb-6 text-sm text-[var(--text-muted)]">Cadastro manual — publica direto (sem revisão por IA neste protótipo).</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Tipo de imóvel</label>
              <select
                className={inputClass}
                value={form.tipoUnidade}
                onChange={(e) => update('tipoUnidade', e.target.value as TipoUnidade)}
              >
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
            <label className="text-xs font-semibold text-[var(--text-muted)]">Data de entrega (mês/ano — se já pronto, pode ser uma data passada)</label>
            <input type="month" required className={inputClass} value={form.deliveryDate} onChange={(e) => update('deliveryDate', e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Preço (ex: R$ 890.000 ou R$ 3.500/mês)</label>
            <input required className={inputClass} value={form.price} onChange={(e) => update('price', e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Localização (bairro, cidade — GO)</label>
            <input required className={inputClass} value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Setor Bueno, Goiânia — GO" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Quartos</label>
              <input required className={inputClass} value={form.beds} onChange={(e) => update('beds', e.target.value)} placeholder="3 qts" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Vagas</label>
              <input required className={inputClass} value={form.parking} onChange={(e) => update('parking', e.target.value)} placeholder="2 vg" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Área</label>
              <input required className={inputClass} value={form.area} onChange={(e) => update('area', e.target.value)} placeholder="98 m²" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Descrição (opcional — se deixar em branco, gera uma básica)</label>
            <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Comodidades (separadas por vírgula)</label>
            <input className={inputClass} value={form.amenities} onChange={(e) => update('amenities', e.target.value)} placeholder="Piscina, Academia, Portaria 24h" />
          </div>

          <div className="flex items-center gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.aceitaTemporada} onChange={(e) => update('aceitaTemporada', e.target.checked)} />
              Aceita temporada
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.video} onChange={(e) => update('video', e.target.checked)} />
              Tem vídeo de capa
            </label>
          </div>

          <button type="submit" className="mt-2 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
            Publicar imóvel
          </button>
        </form>
      </main>
    </div>
  );
}
