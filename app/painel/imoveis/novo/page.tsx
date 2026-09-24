'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PainelNav from '@/components/PainelNav';
import ChipSelect from '@/components/ChipSelect';
import AmenitiesCheckboxes from '@/components/AmenitiesCheckboxes';
import PhotoUploadField from '@/components/PhotoUploadField';
import CepField, { ENDERECO_VAZIO, formatLocation, type Endereco } from '@/components/CepField';
import MultiChipSelect from '@/components/MultiChipSelect';
import { useStaffSession } from '@/lib/use-staff-session';
import { createProperty, createDevelopment, getAllDevelopments } from '@/lib/actions';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import type { Development } from '@/lib/property-details';
import { maskCurrencyInput } from '@/lib/currency';

const inputClass = 'rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none';
const QUARTO_OPCOES = ['1', '2', '3', '4', '5+'];
const VAGA_OPCOES = ['1', '2', '3', '4', '5+'];
const BANHEIRO_OPCOES = ['1', '2', '3', '4', '5+'];
const TODOS_OS_TIPOS = TIPO_UNIDADE_GRUPOS.flatMap((g) => g.tipos).map((t) => ({ value: t, label: TIPO_UNIDADE_LABEL[t] }));
const QUARTOS_MULTI = ['1', '2', '3', '4', '5'].map((q) => ({ value: q, label: q === '5' ? '5+' : q }));

export default function NovoImovelPage() {
  const { staff, loaded } = useStaffSession();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !staff) router.replace('/painel/login');
  }, [loaded, staff, router]);

  const [modo, setModo] = useState<'imovel' | 'empreendimento'>('imovel');
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [todosCondominios, setTodosCondominios] = useState<Development[]>([]);

  useEffect(() => {
    getAllDevelopments().then(setTodosCondominios);
  }, [success]); // recarrega a lista depois de publicar um condomínio novo

  // ---------- Formulário: imóvel avulso ----------
  const [imovel, setImovel] = useState({
    titulo: '',
    tipoUnidade: 'apartamento' as TipoUnidade,
    finalidade: 'venda' as 'venda' | 'aluguel',
    deliveryDate: '',
    priceDigits: '',
    priceSuffix: '' as '' | '/mês',
    quartos: '',
    vagas: '',
    banheiros: '',
    escaninhos: '',
    area: '',
    aceitaTemporada: false,
    video: false,
    videoUrl: '',
    description: '',
    amenities: [] as string[],
    empreendimentoId: '',
    condominio: '',
    endereco: ENDERECO_VAZIO as Endereco,
    photos: [] as string[]
  });

  // ---------- Formulário: empreendimento/condomínio ----------
  const [dev, setDev] = useState({
    name: '',
    deliveryDate: '',
    tipo: 'vertical' as 'vertical' | 'horizontal',
    pavimentos: '',
    areaTerreno: '',
    description: '',
    amenities: [] as string[],
    aceitaTemporada: false,
    video: false,
    videoUrl: '',
    endereco: ENDERECO_VAZIO as Endereco,
    photos: [] as string[],
    tiposUnidade: [] as TipoUnidade[],
    quartosOpcoes: [] as string[]
  });
  const [detalharTipologias, setDetalharTipologias] = useState(false);

  type Tipologia = { id: string; tipoUnidade: TipoUnidade; quartos: string; vagas: string; area: string; priceDigits: string };
  const [tipologias, setTipologias] = useState<Tipologia[]>([
    { id: 'tip-1', tipoUnidade: 'apartamento', quartos: '', vagas: '', area: '', priceDigits: '' }
  ]);
  const tipologiaPreenchida = (t: Tipologia) => !!(t.quartos || t.area || t.priceDigits);

  const addTipologia = () => {
    setTipologias((prev) => [...prev, { id: `tip-${Date.now()}`, tipoUnidade: 'apartamento', quartos: '', vagas: '', area: '', priceDigits: '' }]);
  };
  const removeTipologia = (id: string) => {
    setTipologias((prev) => (prev.length > 1 ? prev.filter((t) => t.id !== id) : [{ ...prev[0], quartos: '', vagas: '', area: '', priceDigits: '' }]));
  };
  const updateTipologia = <K extends keyof Tipologia>(id: string, key: K, value: Tipologia[K]) => {
    setTipologias((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)));
  };

  if (!loaded || !staff) return null;

  const updateImovel = <K extends keyof typeof imovel>(key: K, value: (typeof imovel)[K]) => {
    setImovel((prev) => ({ ...prev, [key]: value }));
  };
  const updateDev = <K extends keyof typeof dev>(key: K, value: (typeof dev)[K]) => {
    setDev((prev) => ({ ...prev, [key]: value }));
  };

  const parsePriceDigits = (digits: string): number => Number(digits.replace(/\D/g, '')) || 0;

  const handleSubmitImovel = async (e: FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    setFormError(null);
    const location = formatLocation(imovel.endereco);
    if (!imovel.endereco.bairro || !imovel.endereco.cidade) {
      setFormError('Preencha o CEP (ou bairro e cidade) para o imóvel aparecer nas buscas por localização.');
      return;
    }
    setSubmitting(true);
    const id = `manual-${Date.now()}`;

    try {
    await createProperty({
      id,
      titulo: imovel.titulo || undefined,
      tipoUnidade: imovel.tipoUnidade,
      finalidade: imovel.finalidade,
      deliveryDate: imovel.deliveryDate || new Date().toISOString().slice(0, 7),
      priceValue: parsePriceDigits(imovel.priceDigits),
      pricePeriod: imovel.finalidade === 'aluguel' && imovel.priceSuffix === '/mês' ? 'mensal' : 'unico',
      location,
      quartos: imovel.quartos ? Number(imovel.quartos.replace('+', '')) : undefined,
      vagas: imovel.vagas ? Number(imovel.vagas.replace('+', '')) : undefined,
      banheiros: imovel.banheiros ? Number(imovel.banheiros.replace('+', '')) : undefined,
      escaninhos: imovel.escaninhos && imovel.escaninhos !== '0' ? Number(imovel.escaninhos.replace('+', '')) : undefined,
      area: imovel.area ? Number(imovel.area) : undefined,
      video: imovel.video,
      videoUrl: imovel.video ? imovel.videoUrl : undefined,
      aceitaTemporada: imovel.aceitaTemporada,
      description:
        imovel.description ||
        `Imóvel ${imovel.finalidade === 'aluguel' ? 'disponível para locação' : 'à venda'} em ${imovel.condominio ? `${imovel.condominio}, ` : ''}${location}.`,
      amenities: imovel.amenities,
      empreendimentoId: imovel.empreendimentoId || undefined,
      corretorEmail: staff!.email,
      photos: imovel.photos,
      condominio: imovel.condominio || undefined,
      ...imovel.endereco
    });
    } catch {
      setFormError('Não foi possível publicar agora. Confira sua conexão e tente de novo.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSuccess(id);
  };

  const handleSubmitDev = async (e: FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    setFormError(null);
    const location = formatLocation(dev.endereco);
    const tipologiasValidas = detalharTipologias ? tipologias.filter(tipologiaPreenchida) : [];
    const tiposUnidade = Array.from(new Set([...dev.tiposUnidade, ...tipologiasValidas.map((t) => t.tipoUnidade)]));
    if (!dev.endereco.bairro || !dev.endereco.cidade) {
      setFormError('Preencha o CEP (ou bairro e cidade) do empreendimento.');
      return;
    }
    if (tiposUnidade.length === 0) {
      setFormError('Marque pelo menos um tipo de imóvel que existe no empreendimento (ex: Casa em Condomínio, Sobrado, Apartamento).');
      return;
    }
    setSubmitting(true);
    const id = `condo-${Date.now()}`;
    const deliveryDate = dev.deliveryDate || new Date().toISOString().slice(0, 7);
    const tiposTexto = tiposUnidade.map((t) => TIPO_UNIDADE_LABEL[t].toLowerCase()).join(', ');

    try {
    await createDevelopment({
      id,
      name: dev.name,
      location,
      deliveryDate,
      description:
        dev.description ||
        `${dev.name}: condomínio ${dev.tipo === 'vertical' ? 'vertical' : 'horizontal'} em ${location}, com ${tiposTexto}.`,
      photos: dev.photos,
      tiposUnidade,
      quartosOpcoes: dev.quartosOpcoes.map(Number),
      ...dev.endereco,
      tipo: dev.tipo,
      pavimentos: dev.tipo === 'vertical' && dev.pavimentos ? Number(dev.pavimentos) : undefined,
      areaTerreno: dev.tipo === 'horizontal' && dev.areaTerreno ? `${dev.areaTerreno} m²` : undefined,
      amenities: dev.amenities,
      aceitaTemporada: dev.aceitaTemporada,
      videoUrl: dev.video ? dev.videoUrl : undefined,
      corretorEmail: staff!.email
    });

    // Cada tipologia informada vira um imóvel avulso já vinculado a este
    // condomínio — é assim que elas aparecem tanto na página do
    // empreendimento quanto no feed geral do Comprar (mesmo mecanismo do
    // vínculo manual imóvel → condomínio).
    for (const [i, t] of tipologiasValidas.entries()) {
      await createProperty({
        id: `${id}-tip-${i}`,
        tipoUnidade: t.tipoUnidade,
        finalidade: 'venda',
        deliveryDate,
        priceValue: parsePriceDigits(t.priceDigits),
        pricePeriod: 'unico',
        location,
        quartos: t.quartos ? Number(t.quartos.replace('+', '')) : undefined,
        vagas: t.vagas ? Number(t.vagas.replace('+', '')) : undefined,
        area: t.area ? Number(t.area) : undefined,
        video: false,
        aceitaTemporada: dev.aceitaTemporada,
        description: `${TIPO_UNIDADE_LABEL[t.tipoUnidade]}${t.quartos ? ` de ${t.quartos} quartos` : ''}${t.area ? `, ${t.area} m²` : ''} no ${dev.name}, em ${location}.`,
        amenities: dev.amenities,
        empreendimentoId: id,
        corretorEmail: staff!.email,
        photos: dev.photos, // a unidade usa as fotos do empreendimento até ter as próprias
        condominio: dev.name,
        ...dev.endereco
      });
    }
    } catch {
      setFormError('Não foi possível publicar agora. Confira sua conexão e tente de novo.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSuccess(id);
  };

  if (success) {
    const isDev = success.startsWith('condo-');
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
      <PainelNav />
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
      <PainelNav />
      <main className="mx-auto w-full max-w-xl px-5 py-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold">Cadastrar</h1>
        <p className="mt-1 mb-5 text-sm text-[var(--text-muted)]">Cadastro manual — publica direto (sem revisão por IA neste protótipo).</p>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => { setModo('imovel'); setFormError(null); }}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${modo === 'imovel' ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
          >
            Imóvel avulso
          </button>
          <button
            type="button"
            onClick={() => { setModo('empreendimento'); setFormError(null); }}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${modo === 'empreendimento' ? 'bg-ink text-white' : 'bg-[var(--pill-bg)] hover:bg-[var(--pill-bg-hover)]'}`}
          >
            Empreendimento / Condomínio
          </button>
        </div>

        {modo === 'imovel' ? (
          <form onSubmit={handleSubmitImovel} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Título do anúncio (opcional — se deixar em branco, gera um genérico)</label>
              <input
                className={inputClass}
                value={imovel.titulo}
                onChange={(e) => updateImovel('titulo', e.target.value)}
                placeholder="Ex: Apartamento à venda no Setor Bueno, 3 quartos"
              />
            </div>

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
              <select
                className={inputClass}
                value={imovel.empreendimentoId}
                onChange={(e) => {
                  const id = e.target.value;
                  const condo = todosCondominios.find((c) => c.id === id);
                  setImovel((prev) => ({ ...prev, empreendimentoId: id, condominio: condo ? condo.name : prev.condominio }));
                }}
              >
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

            <CepField
              value={imovel.endereco}
              onChange={(v) => updateImovel('endereco', v)}
              onPickCondominio={(sug) =>
                setImovel((prev) => ({
                  ...prev,
                  condominio: sug.nome,
                  empreendimentoId: sug.kind === 'empreendimento' && sug.id ? sug.id : prev.empreendimentoId
                }))
              }
            />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Nome do condomínio / edifício (opcional)</label>
              <input
                className={inputClass}
                value={imovel.condominio}
                onChange={(e) => updateImovel('condominio', e.target.value)}
                placeholder="Ex: Residencial Bueno, Edifício Parque Areião"
              />
              <span className="text-xs text-[var(--text-faint)]">Aparece no anúncio e deixa o imóvel ser encontrado pela busca pelo nome do condomínio.</span>
            </div>

            <ChipSelect label="Quartos" options={QUARTO_OPCOES} value={imovel.quartos} onChange={(v) => updateImovel('quartos', v)} />
            <ChipSelect label="Vagas de garagem" options={VAGA_OPCOES} value={imovel.vagas} onChange={(v) => updateImovel('vagas', v)} />
            <ChipSelect label="Banheiros" options={BANHEIRO_OPCOES} value={imovel.banheiros} onChange={(v) => updateImovel('banheiros', v)} />
            <ChipSelect label="Escaninhos" options={['0', '1', '2', '3+']} value={imovel.escaninhos} onChange={(v) => updateImovel('escaninhos', v)} />

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

            <PhotoUploadField photos={imovel.photos} onChange={(v) => updateImovel('photos', v)} onUploadingChange={setUploading} />

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

            {formError && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
            <button type="submit" disabled={submitting || uploading} className="mt-2 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Publicando…' : uploading ? 'Aguarde as fotos…' : 'Publicar imóvel'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitDev} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Nome do condomínio</label>
              <input required className={inputClass} value={dev.name} onChange={(e) => updateDev('name', e.target.value)} placeholder="Residencial Jardins do Cerrado" />
            </div>

            <CepField value={dev.endereco} onChange={(v) => updateDev('endereco', v)} modo="empreendimento" />

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

            <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] p-4">
              <MultiChipSelect
                label="Quais tipos de imóvel existem no empreendimento? (marque todos que souber)"
                hint="Não precisa saber metragem nem preço — isso já faz o empreendimento aparecer no filtro por tipo."
                options={TODOS_OS_TIPOS}
                value={dev.tiposUnidade}
                onChange={(v) => updateDev('tiposUnidade', v)}
              />
              <MultiChipSelect
                label="Opções de quartos (opcional, se souber)"
                hint="Ex: casas de 3 e 4 quartos → marque 3 e 4. Ajuda no filtro de quartos."
                options={QUARTOS_MULTI}
                value={dev.quartosOpcoes}
                onChange={(v) => updateDev('quartosOpcoes', v)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Descrição (opcional — se deixar em branco, gera uma básica)</label>
              <textarea rows={3} className={inputClass} value={dev.description} onChange={(e) => updateDev('description', e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Área de lazer</label>
              <AmenitiesCheckboxes selected={dev.amenities} onChange={(v) => updateDev('amenities', v)} />
            </div>

            <PhotoUploadField
              label="Fotos do empreendimento (fachada, área comum, decorado)"
              folder="empreendimentos"
              photos={dev.photos}
              onChange={(v) => updateDev('photos', v)}
              onUploadingChange={setUploading}
            />

            <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] p-4 text-sm">
              <input type="checkbox" className="mt-0.5" checked={detalharTipologias} onChange={(e) => setDetalharTipologias(e.target.checked)} />
              <span>
                <strong>Detalhar tipologias da tabela de vendas (opcional)</strong>
                <span className="block text-xs text-[var(--text-faint)]">
                  Marque se tiver a tabela: cada tipologia (metragem, quartos, valor) vira um anúncio vinculado ao empreendimento. Pode deixar os quartos em
                  branco quando a tabela só traz a metragem.
                </span>
              </span>
            </label>

            {detalharTipologias && (
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold">Tipologias do empreendimento</label>
                <button type="button" onClick={addTipologia} className="rounded-full bg-[var(--pill-bg)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--pill-bg-hover)]">
                  + Adicionar tipologia
                </button>
              </div>

              {tipologias.map((t, i) => (
                <div key={t.id} className="flex flex-col gap-2 rounded-lg bg-[var(--pill-bg)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">Tipologia {i + 1}</span>
                    <button type="button" onClick={() => removeTipologia(t.id)} className="text-xs font-semibold text-red-600 hover:underline">
                      {tipologias.length > 1 ? 'Remover' : 'Limpar'}
                    </button>
                  </div>

                  <select
                    className={inputClass}
                    value={t.tipoUnidade}
                    onChange={(e) => updateTipologia(t.id, 'tipoUnidade', e.target.value as TipoUnidade)}
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

                  <ChipSelect label="Quartos (opcional)" options={QUARTO_OPCOES} value={t.quartos} onChange={(v) => updateTipologia(t.id, 'quartos', v === t.quartos ? '' : v)} />
                  <ChipSelect label="Vagas (opcional)" options={VAGA_OPCOES} value={t.vagas} onChange={(v) => updateTipologia(t.id, 'vagas', v === t.vagas ? '' : v)} />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="Área (m²)"
                      value={t.area}
                      onChange={(e) => updateTipologia(t.id, 'area', e.target.value)}
                    />
                    <input
                      className={inputClass}
                      placeholder="Preço"
                      value={maskCurrencyInput(t.priceDigits)}
                      onChange={(e) => updateTipologia(t.id, 'priceDigits', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            )}

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
              Depois você também pode cadastrar unidades à venda como "Imóvel avulso" e vincular a este empreendimento — a página dele reúne todos os
              anúncios.
            </p>

            {formError && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
            <button type="submit" disabled={submitting || uploading} className="mt-2 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Publicando…' : uploading ? 'Aguarde as fotos…' : 'Publicar empreendimento'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
