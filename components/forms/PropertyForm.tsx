'use client';

import { useEffect, useState, type FormEvent } from 'react';
import ChipSelect from '@/components/ChipSelect';
import AmenitiesCheckboxes from '@/components/AmenitiesCheckboxes';
import PhotoUploadField from '@/components/PhotoUploadField';
import CepField, { ENDERECO_VAZIO, formatLocation, type Endereco } from '@/components/CepField';
import CondominioPicker from '@/components/forms/CondominioPicker';
import VideoFormato, { pareceVertical } from '@/components/forms/VideoFormato';
import DescriptionEditor from '@/components/forms/DescriptionEditor';
import { listCondominios, type CondominioResumo, type PropertyFields, type PropertyEditData } from '@/lib/actions';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { maskCurrencyInput } from '@/lib/currency';

const inputClass = 'rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none';
const QUARTO_OPCOES = ['1', '2', '3', '4', '5+'];
const VAGA_OPCOES = ['1', '2', '3', '4', '5+'];
const BANHEIRO_OPCOES = ['1', '2', '3', '4', '5+'];

type Values = {
  titulo: string;
  tipoUnidade: TipoUnidade;
  finalidade: 'venda' | 'aluguel';
  deliveryDate: string;
  priceDigits: string;
  priceSuffix: '' | '/mês';
  quartos: string;
  vagas: string;
  banheiros: string;
  escaninhos: string;
  area: string;
  aceitaTemporada: boolean;
  video: boolean;
  videoUrl: string;
  videoVertical: boolean | null; // null = ainda não escolheu (obrigatório quando tem vídeo)
  description: string;
  amenities: string[];
  empreendimentoId: string;
  condominio: string;
  endereco: Endereco;
  photos: string[];
  plantas: string[];
};

const EMPTY: Values = {
  titulo: '',
  tipoUnidade: 'apartamento',
  finalidade: 'venda',
  deliveryDate: '',
  priceDigits: '',
  priceSuffix: '',
  quartos: '',
  vagas: '',
  banheiros: '',
  escaninhos: '',
  area: '',
  aceitaTemporada: false,
  video: false,
  videoUrl: '',
  videoVertical: null,
  description: '',
  amenities: [],
  empreendimentoId: '',
  condominio: '',
  endereco: ENDERECO_VAZIO,
  photos: [],
  plantas: []
};

const chip = (n?: number) => (n == null ? '' : n >= 5 ? '5+' : String(n));

function fromEditData(d: PropertyEditData): Values {
  return {
    titulo: d.titulo ?? '',
    tipoUnidade: d.tipoUnidade,
    finalidade: d.finalidade,
    deliveryDate: d.deliveryDate,
    priceDigits: String(Math.round(d.priceValue || 0)),
    priceSuffix: d.pricePeriod === 'mensal' ? '/mês' : '',
    quartos: chip(d.quartos),
    vagas: chip(d.vagas),
    banheiros: chip(d.banheiros),
    escaninhos: d.escaninhos == null ? '' : d.escaninhos >= 3 ? '3+' : String(d.escaninhos),
    area: d.area != null ? String(d.area) : '',
    aceitaTemporada: d.aceitaTemporada,
    video: d.video,
    videoUrl: d.videoUrl ?? '',
    videoVertical: d.video && d.videoUrl ? !!d.videoVertical : null,
    description: d.description,
    amenities: d.amenities,
    empreendimentoId: d.empreendimentoId ?? '',
    condominio: d.condominio ?? '',
    endereco: { cep: d.cep ?? '', logradouro: d.logradouro ?? '', bairro: d.bairro ?? '', cidade: d.cidade ?? '', uf: d.uf ?? '' },
    photos: d.photos ?? [],
    plantas: d.plantas ?? []
  };
}

const num = (s: string) => (s ? Number(s.replace('+', '')) : undefined);

type Props = {
  initial?: PropertyEditData;
  submitLabel: string;
  onSave: (fields: PropertyFields) => Promise<void>;
};

export default function PropertyForm({ initial, submitLabel, onSave }: Props) {
  const [v, setV] = useState<Values>(initial ? fromEditData(initial) : EMPTY);
  const [condominios, setCondominios] = useState<CondominioResumo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listCondominios().then(setCondominios).catch(() => setCondominios([]));
  }, []);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setV((prev) => ({ ...prev, [key]: value }));

  // Ao escolher o condomínio: puxa o endereço dele (se o imóvel ainda não tem)
  // e o lazer do condomínio para as comodidades do imóvel.
  const escolherCondominio = (c: CondominioResumo | null) => {
    if (!c) {
      setV((prev) => ({ ...prev, empreendimentoId: '', condominio: '' }));
      return;
    }
    setV((prev) => ({
      ...prev,
      empreendimentoId: c.id,
      condominio: c.name,
      endereco: prev.endereco.bairro
        ? prev.endereco
        : { cep: c.cep ?? '', logradouro: c.logradouro ?? '', bairro: c.bairro ?? '', cidade: c.cidade ?? '', uf: c.uf ?? '' },
      amenities: Array.from(new Set([...prev.amenities, ...c.amenities]))
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    setErro(null);
    const location = formatLocation(v.endereco);
    if (!v.endereco.bairro || !v.endereco.cidade) {
      setErro('Preencha o CEP (ou bairro e cidade) para o imóvel aparecer nas buscas por localização.');
      return;
    }
    if (v.video && v.videoUrl.trim() && v.videoVertical === null) {
      setErro('Escolha o formato do vídeo (Deitado ou Em pé) antes de publicar.');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        titulo: v.titulo || undefined,
        tipoUnidade: v.tipoUnidade,
        finalidade: v.finalidade,
        deliveryDate: v.deliveryDate || new Date().toISOString().slice(0, 7),
        priceValue: Number(v.priceDigits.replace(/\D/g, '')) || 0,
        pricePeriod: v.finalidade === 'aluguel' && v.priceSuffix === '/mês' ? 'mensal' : 'unico',
        location,
        quartos: num(v.quartos),
        vagas: num(v.vagas),
        banheiros: num(v.banheiros),
        escaninhos: v.escaninhos && v.escaninhos !== '0' ? num(v.escaninhos) : undefined,
        area: v.area ? Number(v.area) : undefined,
        video: v.video,
        videoUrl: v.video ? v.videoUrl : undefined,
        videoVertical: v.video && !!v.videoVertical,
        aceitaTemporada: v.aceitaTemporada,
        description:
          v.description ||
          `Imóvel ${v.finalidade === 'aluguel' ? 'disponível para locação' : 'à venda'} em ${v.condominio ? `${v.condominio}, ` : ''}${location}.`,
        amenities: v.amenities,
        empreendimentoId: v.empreendimentoId || undefined,
        photos: v.photos,
        plantas: v.plantas,
        condominio: v.condominio || undefined,
        ...v.endereco
      });
    } catch {
      setErro('Não foi possível salvar agora. Confira sua conexão (e se a sessão do painel não expirou) e tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  // Nome dos arquivos de imagem: condomínio (ou título) + tipo + bairro — ex.: "marista-262-apartamento-setor-marista"
  const nomeArquivo = [v.condominio || v.titulo, TIPO_UNIDADE_LABEL[v.tipoUnidade], v.endereco.bairro].filter(Boolean).join(' ');
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Título do anúncio (opcional — se deixar em branco, gera um genérico)</label>
        <input className={inputClass} value={v.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex: Apartamento à venda no Setor Bueno, 3 quartos" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Tipo de imóvel</label>
          <select className={inputClass} value={v.tipoUnidade} onChange={(e) => set('tipoUnidade', e.target.value as TipoUnidade)}>
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
          <select className={inputClass} value={v.finalidade} onChange={(e) => set('finalidade', e.target.value as 'venda' | 'aluguel')}>
            <option value="venda">Venda</option>
            <option value="aluguel">Aluguel</option>
          </select>
        </div>
      </div>

      <CondominioPicker
        condominios={condominios}
        selectedId={v.empreendimentoId}
        onSelect={escolherCondominio}
        onCreated={(c) => {
          setCondominios((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
          escolherCondominio(c);
        }}
      />

      <CepField
        value={v.endereco}
        onChange={(e) => set('endereco', e)}
        onPickCondominio={(sug) => {
          const c = sug.id ? condominios.find((x) => x.id === sug.id) : undefined;
          if (c) escolherCondominio(c);
          else set('condominio', sug.nome);
        }}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Data de entrega (mês/ano — se já pronto, pode ser uma data passada)</label>
        <input type="month" required className={inputClass} value={v.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Preço</label>
          <input required inputMode="numeric" className={inputClass} value={maskCurrencyInput(v.priceDigits)} onChange={(e) => set('priceDigits', e.target.value)} placeholder="R$ 0" />
        </div>
        {v.finalidade === 'aluguel' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Período</label>
            <select className={inputClass} value={v.priceSuffix} onChange={(e) => set('priceSuffix', e.target.value as '' | '/mês')}>
              <option value="/mês">/mês</option>
              <option value="">Valor único</option>
            </select>
          </div>
        )}
      </div>

      <ChipSelect label="Quartos" options={QUARTO_OPCOES} value={v.quartos} onChange={(x) => set('quartos', x)} />
      <ChipSelect label="Vagas de garagem" options={VAGA_OPCOES} value={v.vagas} onChange={(x) => set('vagas', x)} />
      <ChipSelect label="Banheiros" options={BANHEIRO_OPCOES} value={v.banheiros} onChange={(x) => set('banheiros', x)} />
      <ChipSelect label="Escaninhos" options={['0', '1', '2', '3+']} value={v.escaninhos} onChange={(x) => set('escaninhos', x)} />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Área (m²)</label>
        <input required type="number" className={inputClass} value={v.area} onChange={(e) => set('area', e.target.value)} placeholder="98" />
      </div>

      <DescriptionEditor
        label="Descrição (opcional — se deixar em branco, gera uma básica)"
        value={v.description}
        onChange={(x) => set('description', x)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Comodidades (o lazer do condomínio entra sozinho ao escolher o condomínio)</label>
        <AmenitiesCheckboxes selected={v.amenities} onChange={(x) => set('amenities', x)} />
      </div>

      <PhotoUploadField photos={v.photos} onChange={(x) => set('photos', x)} onUploadingChange={setUploading} nomeArquivo={nomeArquivo} />

      <PhotoUploadField
        label="Planta do imóvel (opcional)"
        folder="plantas"
        nomeArquivo={`${nomeArquivo} planta`}
        modo="plantas"
        photos={v.plantas}
        onChange={(x) => set('plantas', x)}
        onUploadingChange={setUploading}
      />

      <div className="flex flex-col gap-2 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.aceitaTemporada} onChange={(e) => set('aceitaTemporada', e.target.checked)} />
          Aceita temporada
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.video} onChange={(e) => set('video', e.target.checked)} />
          Tem vídeo de capa
        </label>
        {v.video && (
          <div className="flex flex-col gap-1">
            <input
              type="url"
              className={inputClass}
              placeholder="Link do YouTube ou Instagram"
              value={v.videoUrl}
              onChange={(e) => {
                const url = e.target.value;
                setV((prev) => ({ ...prev, videoUrl: url, videoVertical: pareceVertical(url) ? true : prev.videoVertical }));
              }}
            />
            <VideoFormato vertical={v.videoVertical} onChange={(x) => set('videoVertical', x)} />
            <span className="text-xs text-[var(--text-faint)]">
              YouTube: cole o link da barra de endereço ao assistir o vídeo (ex: youtube.com/watch?v=... ou youtu.be/...). Instagram: abra o Reel/post,
              toque em &quot;...&quot; → Copiar link. Precisa ser um post público.
            </span>
          </div>
        )}
      </div>

      {erro && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <button type="submit" disabled={submitting || uploading} className="mt-2 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
        {submitting ? 'Salvando…' : uploading ? 'Aguarde as fotos…' : submitLabel}
      </button>
    </form>
  );
}
