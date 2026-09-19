'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ChipSelect from '@/components/ChipSelect';
import AmenitiesCheckboxes from '@/components/AmenitiesCheckboxes';
import { useStaffSession } from '@/lib/use-staff-session';
import { useCreatedProperties } from '@/lib/use-created-properties';
import { useCreatedDevelopments } from '@/lib/use-created-developments';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { DEVELOPMENTS, type PropertyDetail, type Development } from '@/lib/property-details';
import { maskCurrencyInput, appendSuffix } from '@/lib/currency';

const inputClass = 'rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none';
const QUARTO_OPCOES = ['1', '2', '3', '4', '5+'];
const VAGA_OPCOES = ['1', '2', '3', '4', '5+'];
const BANHEIRO_OPCOES = ['1', '2', '3', '4', '5+'];

export default function NovoImovelPage() {
  const { staff, loaded } = useStaffSession();
  const { add: addProperty } = useCreatedProperties();
  const { items: createdDevelopments, add: addDevelopment } = useCreatedDevelopments();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  const [modo, setModo] = useState<'imovel' | 'empreendimento'>('imovel');
  const [success, setSuccess] = useState<string | null>(null);

  // ---------- Formulário: imóvel avulso ----------
  const [imovel, setImovel] = useState({
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
    video: false,
    videoUrl: '',
    description: '',
    amenities: [] as string[],
    empreendimentoId: ''
  });

  // ---------- Formulário: empreendimento/condomínio ----------
  const [dev, setDev] = useState({
    name: '',
    location: '',
    deliveryDate: '',
    tipo: 'vertical' as 'vertical' | 'horizontal',
    pavimentos: '',
    areaTerreno: '',
    description: '',
    amenities: [] as string[],
    aceitaTemporada: false,
    video: false,
    videoUrl: ''
  });

  if (!loaded || !staff) return null;

  const todosCondominios: (Development | { id: string; name: string })[] = [...DEVELOPMENTS, ...createdDevelopments];

  const updateImovel = <K extends keyof typeof imovel>(key: K, value: (typeof imovel)[K]) => {
    setImovel((prev) => ({ ...prev, [key]: value }));
  };
  const updateDev = <K extends keyof typeof dev>(key: K, value: (typeof dev)[K]) => {
    setDev((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitImovel = (e: FormEvent) => {
    e.preventDefault();
    const id = `manual-${Date.now()}`;
    const priceFormatted = appendSuffix(maskCurrencyInput(imovel.priceDigits), imovel.finalidade === 'aluguel' ? imovel.priceSuffix : '');

    const property: PropertyDetail = {
      id,
      tipoUnidade: imovel.tipoUnidade,
      finalidade: imovel.finalidade,
      deliveryDate: imovel.deliveryDate || new Date().toISOString().slice(0, 7),
      price: priceFormatted,
      location: imovel.location,
      beds: `${imovel.quartos} qts`,
      parking: `${imovel.vagas} vg`,
      banheiros: imovel.banheiros ? `${imovel.banheiros} banheiros` : undefined,
      videoUrl: imovel.video ? imovel.videoUrl : undefined,
      area: `${imovel.area} m²`,
      height: 240 + Math.floor(Math.random() * 100),
      video: imovel.video,
      aceitaTemporada: imovel.aceitaTemporada,
      matchScore: 50,
      description: imovel.description || `Imóvel ${imovel.finalidade === 'aluguel' ? 'disponível para locação' : 'à venda'} em ${imovel.location}.`,
      amenities: imovel.amenities,
      empreendimentoId: imovel.empreendimentoId || undefined,
      corretorEmail: staff!.email
    };

    addProperty(property);
    setSuccess(id);
  };

  const handleSubmitDev = (e: FormEvent) => {
    e.preventDefault();
    const id = `condo-${Date.now()}`;
    const deliveryDate = dev.deliveryDate || new Date().toISOString().slice(0, 7);
    const [year, month] = deliveryDate.split('-');
    const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const deliveryNote = `Previsão de entrega: ${MESES[Number(month) - 1] ?? month} de ${year}`;

    const development: Development = {
      id,
      name: dev.name,
      location: dev.location,
      deliveryDate,
      deliveryNote,
      description: dev.description || `Condomínio ${dev.tipo === 'vertical' ? 'vertical' : 'horizontal'} em ${dev.location}.`,
      tipo: dev.tipo,
      pavimentos: dev.tipo === 'vertical' && dev.pavimentos ? Number(dev.pavimentos) : undefined,
      areaTerreno: dev.tipo === 'horizontal' && dev.areaTerreno ? `${dev.areaTerreno} m²` : undefined,
      amenities: dev.amenities,
      aceitaTemporada: dev.aceitaTemporada,
      heroHeight: 300,
      videoUrl: dev.video ? dev.videoUrl : undefined,
      corretorEmail: staff!.email,
      units: []
    };

    addDevelopment(development);
    setSuccess(id);
  };

  if (success) {
    const isDev = success.startsWith('condo-');
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
          <h1 className="font-serif text-2xl font-semibold">{isDev ? 'Condomínio cadastrado!' : 'Imóvel cadastrado!'}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {isDev
              ? 'Já está publicado. Agora você pode cadastrar imóveis avulsos e vinculá-los a este condomínio.'
              : 'Já está publicado — aparece no feed do Comprar e tem página própria.'}
          </p>
          <div className="flex gap-3">
            <a
              href={isDev ? `/empreendimento/${success}` : `/imovel/${success}`}
              className="rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              {isDev ? 'Ver condomínio' : 'Ver o imóvel'}
            </a>
            <button
              type="button"
              onClick={() => setSuccess(null)}
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
        <h1 className="font-serif text-2xl font-semibold">Cadastrar</h1>
        <p className="mt-1 mb-5 text-sm text-[var(--text-muted)]">Cadastro manual — publica direto (sem revisão por IA neste protótipo).</p>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setModo('imovel')}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${modo === 'imovel' ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
          >
            Imóvel avulso
          </button>
          <button
            type="button"
            onClick={() => setModo('empreendimento')}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${modo === 'empreendimento' ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
          >
            Empreendimento / Condomínio
          </button>
        </div>

        {modo === 'imovel' ? (
          <form onSubmit={handleSubmitImovel} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Tipo de imóvel</label>
                <select className={inputClass} value={imovel.tipoUnidade} onChange={(e) => updateImovel('tipoUnidade', e.target.value as TipoUnidade)}>
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
                <select className={inputClass} value={imovel.finalidade} onChange={(e) => updateImovel('finalidade', e.target.value as 'venda' | 'aluguel')}>
                  <option value="venda">Venda</option>
                  <option value="aluguel">Aluguel</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Este imóvel pertence a um condomínio? (opcional)</label>
              <select className={inputClass} value={imovel.empreendimentoId} onChange={(e) => updateImovel('empreendimentoId', e.target.value)}>
                <option value="">Nenhum / avulso</option>
                {todosCondominios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[var(--text-faint)]">Vincular junta este anúncio com os outros do mesmo condomínio, numa página só.</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Data de entrega (mês/ano — se já pronto, pode ser uma data passada)</label>
              <input type="month" required className={inputClass} value={imovel.deliveryDate} onChange={(e) => updateImovel('deliveryDate', e.target.value)} />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Preço</label>
                <input
                  required
                  inputMode="numeric"
                  className={inputClass}
                  value={maskCurrencyInput(imovel.priceDigits)}
                  onChange={(e) => updateImovel('priceDigits', e.target.value)}
                  placeholder="R$ 0"
                />
              </div>
              {imovel.finalidade === 'aluguel' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">Período</label>
                  <select className={inputClass} value={imovel.priceSuffix} onChange={(e) => updateImovel('priceSuffix', e.target.value as '' | '/mês')}>
                    <option value="/mês">/mês</option>
                    <option value="">Valor único</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Localização (bairro, cidade — GO)</label>
              <input required className={inputClass} value={imovel.location} onChange={(e) => updateImovel('location', e.target.value)} placeholder="Setor Bueno, Goiânia — GO" />
            </div>

            <ChipSelect label="Quartos" options={QUARTO_OPCOES} value={imovel.quartos} onChange={(v) => updateImovel('quartos', v)} />
            <ChipSelect label="Vagas de garagem" options={VAGA_OPCOES} value={imovel.vagas} onChange={(v) => updateImovel('vagas', v)} />
            <ChipSelect label="Banheiros" options={BANHEIRO_OPCOES} value={imovel.banheiros} onChange={(v) => updateImovel('banheiros', v)} />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Área (m²)</label>
              <input required type="number" className={inputClass} value={imovel.area} onChange={(e) => updateImovel('area', e.target.value)} placeholder="98" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Descrição (opcional — se deixar em branco, gera uma básica)</label>
              <textarea rows={3} className={inputClass} value={imovel.description} onChange={(e) => updateImovel('description', e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Comodidades</label>
              <AmenitiesCheckboxes selected={imovel.amenities} onChange={(v) => updateImovel('amenities', v)} />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={imovel.aceitaTemporada} onChange={(e) => updateImovel('aceitaTemporada', e.target.checked)} />
                Aceita temporada
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={imovel.video} onChange={(e) => updateImovel('video', e.target.checked)} />
                Tem vídeo de capa
              </label>
              {imovel.video && (
                <div className="flex flex-col gap-1">
                  <input
                    type="url"
                    className={inputClass}
                    placeholder="Link do YouTube ou Instagram"
                    value={imovel.videoUrl}
                    onChange={(e) => updateImovel('videoUrl', e.target.value)}
                  />
                  <span className="text-xs text-[var(--text-faint)]">
                    YouTube: cole o link da barra de endereço ao assistir o vídeo (ex: youtube.com/watch?v=... ou youtu.be/...).
                    Instagram: abra o Reel/post, toque em "..." → Copiar link (ex: instagram.com/reel/...). Precisa ser um post público.
                  </span>
                </div>
              )}
            </div>

            <button type="submit" className="mt-2 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
              Publicar imóvel
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitDev} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Nome do condomínio</label>
              <input required className={inputClass} value={dev.name} onChange={(e) => updateDev('name', e.target.value)} placeholder="Residencial Jardins do Cerrado" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Localização (bairro, cidade — GO)</label>
              <input required className={inputClass} value={dev.location} onChange={(e) => updateDev('location', e.target.value)} placeholder="Jardim Goiás, Goiânia — GO" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Tipo de condomínio</label>
                <select className={inputClass} value={dev.tipo} onChange={(e) => updateDev('tipo', e.target.value as 'vertical' | 'horizontal')}>
                  <option value="vertical">Vertical (prédio/torre)</option>
                  <option value="horizontal">Horizontal (loteamento)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Data de entrega</label>
                <input type="month" required className={inputClass} value={dev.deliveryDate} onChange={(e) => updateDev('deliveryDate', e.target.value)} />
              </div>
            </div>

            {dev.tipo === 'vertical' ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Número de pavimentos</label>
                <input type="number" className={inputClass} value={dev.pavimentos} onChange={(e) => updateDev('pavimentos', e.target.value)} placeholder="18" />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-muted)]">Área do terreno (m²)</label>
                <input type="number" className={inputClass} value={dev.areaTerreno} onChange={(e) => updateDev('areaTerreno', e.target.value)} placeholder="48000" />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Descrição (opcional — se deixar em branco, gera uma básica)</label>
              <textarea rows={3} className={inputClass} value={dev.description} onChange={(e) => updateDev('description', e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Área de lazer</label>
              <AmenitiesCheckboxes selected={dev.amenities} onChange={(v) => updateDev('amenities', v)} />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={dev.aceitaTemporada} onChange={(e) => updateDev('aceitaTemporada', e.target.checked)} />
                Condomínio aceita temporada
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={dev.video} onChange={(e) => updateDev('video', e.target.checked)} />
                Tem vídeo institucional
              </label>
              {dev.video && (
                <div className="flex flex-col gap-1">
                  <input
                    type="url"
                    className={inputClass}
                    placeholder="Link do YouTube ou Instagram"
                    value={dev.videoUrl}
                    onChange={(e) => updateDev('videoUrl', e.target.value)}
                  />
                  <span className="text-xs text-[var(--text-faint)]">
                    YouTube: cole o link da barra de endereço ao assistir o vídeo (ex: youtube.com/watch?v=... ou youtu.be/...).
                    Instagram: abra o Reel/post, toque em "..." → Copiar link (ex: instagram.com/reel/...). Precisa ser um post público.
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-[var(--text-faint)]">
              Depois de criar o condomínio, cadastre cada unidade/tipologia como "Imóvel avulso" e vincule a este condomínio — é assim que a página dele
              reúne todos os anúncios.
            </p>

            <button type="submit" className="mt-2 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
              Publicar condomínio
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
