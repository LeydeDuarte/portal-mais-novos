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
import ProprietariosPicker from './ProprietariosPicker';
import { listarCorretoresEquipe } from '@/lib/actions-perfil';
import { useStaffSession } from '@/lib/use-staff-session';
import { lerProprietariosDoImovel } from '@/lib/actions-proprietarios';
import type { ProprietarioDoImovel } from '@/lib/proprietarios';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, ehCasa, type TipoUnidade } from '@/lib/tipologias';
import { maskCurrencyInput } from '@/lib/currency';

const inputClass = 'rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none';
const QUARTO_OPCOES = ['1', '2', '3', '4', '5+'];
const VAGA_OPCOES = ['1', '2', '3', '4+'];
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
  visibilidade: 'publico' | 'privado';
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
  areaLote: string;
  areaTotal: string;
  valorCondominio: string;
  iptuMensal: string;
  complemento: string;
  unidade: string;
  quadra: string;
  lote: string;
  obsInterna: string;
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
  visibilidade: 'publico',
  video: false,
  videoUrl: '',
  videoVertical: null,
  description: '',
  amenities: [],
  empreendimentoId: '',
  condominio: '',
  endereco: ENDERECO_VAZIO,
  photos: [],
  areaLote: '',
  areaTotal: '',
  valorCondominio: '',
  iptuMensal: '',
  complemento: '',
  unidade: '',
  quadra: '',
  lote: '',
  obsInterna: '',
  plantas: []
};

const chip = (n?: number) => (n == null ? '' : n >= 5 ? '5+' : String(n));
const chipVaga = (n?: number) => (n == null ? '' : n >= 4 ? '4+' : String(n));

function fromEditData(d: PropertyEditData): Values {
  return {
    titulo: d.titulo ?? '',
    tipoUnidade: d.tipoUnidade,
    finalidade: d.finalidade,
    deliveryDate: d.deliveryDate,
    priceDigits: d.priceValue ? String(Math.round(d.priceValue)) : '',
    priceSuffix: d.pricePeriod === 'mensal' ? '/mês' : '',
    quartos: chip(d.quartos),
    vagas: chipVaga(d.vagas),
    banheiros: chip(d.banheiros),
    escaninhos: d.escaninhos == null ? '' : d.escaninhos >= 3 ? '3+' : String(d.escaninhos),
    area: d.area != null ? String(d.area) : '',
    aceitaTemporada: d.aceitaTemporada,
    visibilidade: d.visibilidade === 'privado' ? 'privado' : 'publico',
    video: d.video,
    videoUrl: d.videoUrl ?? '',
    videoVertical: d.video && d.videoUrl ? !!d.videoVertical : null,
    description: d.description,
    amenities: d.amenities,
    empreendimentoId: d.empreendimentoId ?? '',
    condominio: d.condominio ?? '',
    endereco: { cep: d.cep ?? '', logradouro: d.logradouro ?? '', bairro: d.bairro ?? '', cidade: d.cidade ?? '', uf: d.uf ?? '' },
    photos: d.photos ?? [],
    areaLote: d.areaLote ? String(d.areaLote) : '',
    areaTotal: d.areaTotal ? String(d.areaTotal) : '',
    valorCondominio: d.valorCondominio ? String(Math.round(d.valorCondominio)) : '',
    iptuMensal: d.iptuMensal ? String(Math.round(d.iptuMensal)) : '',
    complemento: d.complemento ?? '',
    unidade: d.unidade ?? '',
    quadra: d.quadra ?? '',
    lote: d.lote ?? '',
    obsInterna: d.obsInterna ?? '',
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
  const [proprietarios, setProprietarios] = useState<ProprietarioDoImovel[]>([]);
  const { staff } = useStaffSession();
  const gestor = staff?.role === 'admin' || staff?.role === 'analista';
  const [corretores, setCorretores] = useState<{ email: string; nome: string }[]>([]);
  const [responsavelEmail, setResponsavelEmail] = useState(initial?.corretorEmail ?? '');
  useEffect(() => {
    if (gestor) listarCorretoresEquipe().then(setCorretores).catch(() => {});
  }, [gestor]);
  useEffect(() => {
    if (initial?.id) lerProprietariosDoImovel(initial.id).then(setProprietarios).catch(() => {});
  }, [initial?.id]);

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
        deliveryDate: v.deliveryDate || '', // vazio = ano desconhecido ("----")
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
        visibilidade: v.visibilidade,
        description:
          v.description ||
          `Imóvel ${v.finalidade === 'aluguel' ? 'disponível para locação' : 'à venda'} em ${v.condominio ? `${v.condominio}, ` : ''}${location}.`,
        amenities: v.amenities,
        empreendimentoId: v.empreendimentoId || undefined,
        photos: v.photos,
        plantas: v.plantas,
        condominio: v.condominio || undefined,
        ...v.endereco,
        areaLote: v.areaLote ? Number(v.areaLote.replace(',', '.')) : undefined,
        areaTotal: v.areaTotal ? Number(v.areaTotal.replace(',', '.')) : undefined,
        valorCondominio: Number(v.valorCondominio.replace(/\D/g, '')) || undefined,
        iptuMensal: Number(v.iptuMensal.replace(/\D/g, '')) || undefined,
        complemento: v.complemento || undefined,
        unidade: v.unidade || undefined,
        quadra: v.quadra || undefined,
        lote: v.lote || undefined,
        obsInterna: v.obsInterna || undefined,
        proprietarios: proprietarios.map((p) => ({ proprietarioId: p.id, principal: p.principal })),
        corretorResponsavel: gestor && responsavelEmail ? responsavelEmail : undefined
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
        <label className="text-xs font-semibold text-[var(--text-muted)]">Título do anúncio (opcional, se deixar em branco, gera um genérico)</label>
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

      <CepField
        value={v.endereco}
        onChange={(e) => set('endereco', e)}
        onPickCondominio={(sug) => {
          const c = sug.id ? condominios.find((x) => x.id === sug.id) : undefined;
          if (c) escolherCondominio(c);
          else set('condominio', sug.nome);
        }}
      />

      <CondominioPicker
        condominios={condominios}
        selectedId={v.empreendimentoId}
        cidade={v.endereco.cidade}
        textoInicial={v.empreendimentoId ? '' : v.condominio}
        bairro={v.endereco.bairro}
        onSelect={escolherCondominio}
        onCreated={(c) => {
          setCondominios((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
          escolherCondominio(c);
        }}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          {ehCasa(v.tipoUnidade)
            ? 'Ano de entrega da casa (habite-se, é a idade da CASA, não a do condomínio; se não souber, deixe vazio)'
            : 'Data de entrega (mês/ano, se já pronto, pode ser uma data passada; se não souber, deixe vazio)'}
        </label>
        <input type="month" className={inputClass} value={v.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Área privativa (m²)</label>
          <input required type="number" className={inputClass} value={v.area} onChange={(e) => set('area', e.target.value)} placeholder="98" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Área total (m²)</label>
          <input type="number" className={inputClass} value={v.areaTotal} onChange={(e) => set('areaTotal', e.target.value)} placeholder="Só aparece no site se preencher" />
        </div>
        {['casa', 'sobrado', 'casa_condominio', 'terreno_lote', 'chacara_sitio_fazenda'].includes(v.tipoUnidade) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Área do lote (m²)</label>
            <input type="number" className={inputClass} value={v.areaLote} onChange={(e) => set('areaLote', e.target.value)} placeholder="360" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Condomínio (R$/mês)</label>
          <input inputMode="numeric" className={inputClass} value={v.valorCondominio} onChange={(e) => set('valorCondominio', e.target.value.replace(/\D/g, ''))} placeholder="850" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">IPTU (R$/mês)</label>
          <input inputMode="numeric" className={inputClass} value={v.iptuMensal} onChange={(e) => set('iptuMensal', e.target.value.replace(/\D/g, ''))} placeholder="210" />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-transparent">
        <div className="text-sm font-bold">Só para a equipe (nunca aparece no site)</div>
        {/* identificação do imóvel: vai na mensagem de WhatsApp ao proprietário */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Unidade (apto/sala)</label>
            <input className={inputClass} value={v.unidade} onChange={(e) => set('unidade', e.target.value)} placeholder="1502" maxLength={30} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Quadra</label>
            <input className={inputClass} value={v.quadra} onChange={(e) => set('quadra', e.target.value)} placeholder="05" maxLength={20} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Lote</label>
            <input className={inputClass} value={v.lote} onChange={(e) => set('lote', e.target.value)} placeholder="18" maxLength={20} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Complemento (torre, bloco, anotações)</label>
          <input className={inputClass} value={v.complemento} onChange={(e) => set('complemento', e.target.value)} placeholder="Torre B" maxLength={120} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">OBS</label>
          <textarea className={`${inputClass} min-h-[70px]`} value={v.obsInterna} onChange={(e) => set('obsInterna', e.target.value)} placeholder="Chaves na portaria, aceita permuta, melhor horário de visita…" />
        </div>
        <ProprietariosPicker value={proprietarios} onChange={setProprietarios} />
        {gestor && corretores.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Corretor responsável (aparece no anúncio com foto e CRECI)</label>
            <select className={inputClass} value={responsavelEmail} onChange={(e) => setResponsavelEmail(e.target.value)}>
              <option value="">Eu mesmo(a)</option>
              {corretores.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <DescriptionEditor
        label="Descrição (opcional, se deixar em branco, gera uma básica)"
        value={v.description}
        onChange={(x) => set('description', x)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Comodidades (o lazer do condomínio entra sozinho ao escolher o condomínio)</label>
        <AmenitiesCheckboxes selected={v.amenities} onChange={(x) => set('amenities', x)} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-4">
        <span className="text-xs font-semibold text-[var(--text-muted)]">Quem pode ver este anúncio?</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['publico', 'Público', 'Aparece no feed, nas buscas e no Google, com fotos e endereço.'],
              ['privado', 'Privado (portfólio)', 'O proprietário não autorizou publicar. Fora do feed; o público vê só as características e pede para ver. Você manda o link privado para o cliente.']
            ] as const
          ).map(([val, titulo, desc]) => (
            <label
              key={val}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm ${v.visibilidade === val ? 'border-accent bg-[#f5f8ff]' : 'border-[var(--border)]'}`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input type="radio" name="visibilidade" checked={v.visibilidade === val} onChange={() => set('visibilidade', val)} />
                {titulo}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{desc}</span>
            </label>
          ))}
        </div>
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
