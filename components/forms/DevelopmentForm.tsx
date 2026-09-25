'use client';

import { useState } from 'react';
import ChipSelect from '@/components/ChipSelect';
import AmenitiesCheckboxes from '@/components/AmenitiesCheckboxes';
import PhotoUploadField from '@/components/PhotoUploadField';
import MultiChipSelect from '@/components/MultiChipSelect';
import VideoFormato, { pareceVertical } from '@/components/forms/VideoFormato';
import DescriptionEditor from '@/components/forms/DescriptionEditor';
import CepField, { ENDERECO_VAZIO, formatLocation, type Endereco } from '@/components/CepField';
import type { DevelopmentEditData, DevelopmentFields, DevelopmentStatus, TipologiaInput } from '@/lib/actions';
import { TIPO_UNIDADE_GRUPOS, TIPO_UNIDADE_LABEL, type TipoUnidade } from '@/lib/tipologias';
import { maskCurrencyInput } from '@/lib/currency';

const inputClass = 'w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none';
const QUARTO_OPCOES = ['1', '2', '3', '4', '5+'];
const TODOS_OS_TIPOS = TIPO_UNIDADE_GRUPOS.flatMap((g) => g.tipos).map((t) => ({ value: t, label: TIPO_UNIDADE_LABEL[t] }));
const QUARTOS_MULTI = ['1', '2', '3', '4', '5'].map((q) => ({ value: q, label: q === '5' ? '5+' : q }));

type Tip = { key: string; id?: string; tipoUnidade: TipoUnidade; quartos: string; vagas: string; area: string; priceDigits: string; plantas: string[] };

export type DevelopmentSaveResult = { ok: true } | { ok: false; faltando: string[]; duplicado?: { id: string; name: string; bairro: string | null } };

type Props = {
  initial?: DevelopmentEditData;
  onSave: (fields: DevelopmentFields, tipologias: TipologiaInput[]) => Promise<DevelopmentSaveResult>;
};

const numOrUndef = (s: string) => (s ? Number(s.replace('+', '')) : undefined);

export default function DevelopmentForm({ initial, onSave }: Props) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    endereco: (initial
      ? { cep: initial.cep ?? '', logradouro: initial.logradouro ?? '', bairro: initial.bairro ?? '', cidade: initial.cidade ?? '', uf: initial.uf ?? '' }
      : ENDERECO_VAZIO) as Endereco,
    deliveryDate: initial?.deliveryDate ?? '',
    tipo: (initial?.tipo ?? 'vertical') as 'vertical' | 'horizontal',
    pavimentos: initial?.pavimentos ? String(initial.pavimentos) : '',
    areaTerreno: initial?.areaTerreno ? initial.areaTerreno.replace(/\D/g, '') : '',
    description: initial?.description ?? '',
    amenities: initial?.amenities ?? [],
    aceitaTemporada: initial?.aceitaTemporada ?? false,
    video: !!initial?.videoUrl,
    videoUrl: initial?.videoUrl ?? '',
    videoVertical: (initial?.videoUrl ? !!initial.videoVertical : null) as boolean | null,
    photos: initial?.photos ?? [],
    tiposUnidade: (initial?.tiposUnidade ?? []) as TipoUnidade[],
    quartosOpcoes: (initial?.quartosOpcoes ?? []).map((n) => String(Math.min(n, 5)))
  });
  const [tips, setTips] = useState<Tip[]>(
    (initial?.tipologias ?? []).map((t, i) => ({
      key: t.id ?? `t${i}`,
      id: t.id,
      tipoUnidade: t.tipoUnidade,
      quartos: t.quartos == null ? '' : t.quartos >= 5 ? '5+' : String(t.quartos),
      vagas: t.vagas == null ? '' : t.vagas >= 5 ? '5+' : String(t.vagas),
      area: t.area != null ? String(t.area) : '',
      priceDigits: t.priceValue ? String(Math.round(t.priceValue)) : '',
      plantas: t.plantas ?? []
    }))
  );
  const [detalhar, setDetalhar] = useState((initial?.tipologias?.length ?? 0) > 0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<DevelopmentStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [faltando, setFaltando] = useState<string[]>([]);
  const [duplicado, setDuplicado] = useState<{ id: string; name: string; bairro: string | null } | null>(null);

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const updTip = <K extends keyof Tip>(key: string, k: K, value: Tip[K]) => setTips((prev) => prev.map((t) => (t.key === key ? { ...t, [k]: value } : t)));
  const addTip = () => setTips((prev) => [...prev, { key: `n${Date.now()}`, tipoUnidade: f.tiposUnidade[0] ?? 'apartamento', quartos: '', vagas: '', area: '', priceDigits: '', plantas: [] }]);

  // Checklist visível do que falta para publicar
  const pendencias = [
    !f.name.trim() && 'Nome',
    (!f.endereco.bairro || !f.endereco.cidade) && 'Endereço (CEP, ou bairro e cidade)',
    f.video && f.videoUrl.trim() && f.videoVertical === null && 'Formato do vídeo (Deitado ou Em pé)'
  ].filter(Boolean) as string[];

  const salvar = async (status: DevelopmentStatus) => {
    if (uploading) return;
    setErro(null);
    setFaltando([]);
    if (!f.name.trim()) return setErro('Digite o nome do condomínio.');
    if (f.video && f.videoUrl.trim() && f.videoVertical === null) return setErro('Escolha o formato do vídeo (Deitado ou Em pé) antes de salvar.');
    const tipologiasValidas = detalhar ? tips.filter((t) => t.quartos || t.area || t.priceDigits || t.plantas.length) : [];
    const tiposUnidade = Array.from(new Set([...f.tiposUnidade, ...tipologiasValidas.map((t) => t.tipoUnidade)]));
    const location = formatLocation(f.endereco);
    setSaving(status);
    try {
      const res = await onSave(
        {
          name: f.name.trim(),
          location,
          deliveryDate: f.deliveryDate || undefined,
          description: f.description.trim(),
          tipo: f.tipo,
          pavimentos: f.tipo === 'vertical' && f.pavimentos ? Number(f.pavimentos) : undefined,
          areaTerreno: f.tipo === 'horizontal' && f.areaTerreno ? `${Number(f.areaTerreno).toLocaleString('pt-BR')} m²` : undefined,
          amenities: f.amenities,
          aceitaTemporada: f.aceitaTemporada,
          videoUrl: f.video && f.videoUrl ? f.videoUrl : undefined,
          videoVertical: f.video && !!f.videoVertical,
          photos: f.photos,
          tiposUnidade,
          quartosOpcoes: f.quartosOpcoes.map(Number),
          status,
          ...f.endereco
        },
        tipologiasValidas.map((t) => ({
          id: t.id,
          tipoUnidade: t.tipoUnidade,
          quartos: numOrUndef(t.quartos),
          vagas: numOrUndef(t.vagas),
          area: t.area ? Number(t.area) : undefined,
          priceValue: Number(t.priceDigits.replace(/\D/g, '')) || 0,
          plantas: t.plantas
        }))
      );
      setDuplicado(null);
      if (!res.ok) {
        setFaltando(res.faltando);
        if (res.duplicado) setDuplicado(res.duplicado);
      }
    } catch {
      setErro('Não foi possível salvar agora. Confira sua conexão (e se a sessão do painel não expirou) e tente de novo.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar('publicado');
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Nome do condomínio / empreendimento</label>
        <input className={inputClass} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Residencial Jardins do Cerrado" />
      </div>

      <CepField value={f.endereco} onChange={(v) => set('endereco', v)} modo="empreendimento" />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Tipo de condomínio</label>
          <select className={inputClass} value={f.tipo} onChange={(e) => set('tipo', e.target.value as 'vertical' | 'horizontal')}>
            <option value="vertical">Vertical (prédio/torre)</option>
            <option value="horizontal">Horizontal (casas/lotes)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">{f.tipo === 'horizontal' ? 'Entrega do condomínio' : 'Data de entrega'}</label>
          <input type="month" className={inputClass} value={f.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
          {f.tipo === 'horizontal' && <span className="text-[11px] text-[var(--text-faint)]">A idade de cada casa é cadastrada no anúncio da casa.</span>}
        </div>
      </div>

      {f.tipo === 'vertical' ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Número de pavimentos</label>
          <input type="number" className={inputClass} value={f.pavimentos} onChange={(e) => set('pavimentos', e.target.value)} placeholder="18" />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--text-muted)]">Área do terreno (m²)</label>
          <input type="number" className={inputClass} value={f.areaTerreno} onChange={(e) => set('areaTerreno', e.target.value)} placeholder="48000" />
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] p-4">
        <MultiChipSelect
          label="Quais tipos de imóvel existem no condomínio? (marque todos que souber)"
          hint="Não precisa saber metragem nem preço, isso já faz o condomínio aparecer no filtro por tipo."
          options={TODOS_OS_TIPOS}
          value={f.tiposUnidade}
          onChange={(x) => set('tiposUnidade', x)}
        />
        <MultiChipSelect
          label="Opções de quartos (opcional, se souber)"
          hint="Ex: casas de 3 e 4 quartos → marque 3 e 4."
          options={QUARTOS_MULTI}
          value={f.quartosOpcoes}
          onChange={(x) => set('quartosOpcoes', x)}
        />
      </div>

      <DescriptionEditor
        label="Narrativa do condomínio (opcional, pode completar depois de publicar)"
        value={f.description}
        onChange={(x) => set('description', x)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[var(--text-muted)]">Lazer e diferenciais</label>
        <AmenitiesCheckboxes selected={f.amenities} onChange={(x) => set('amenities', x)} />
      </div>

      <PhotoUploadField
        label="Fotos do condomínio (fachada, área comum, decorado), opcional"
        folder="empreendimentos"
        nomeArquivo={f.name}
        photos={f.photos}
        onChange={(x) => set('photos', x)}
        onUploadingChange={setUploading}
      />

      <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] p-4 text-sm">
        <input type="checkbox" className="mt-0.5" checked={detalhar} onChange={(e) => setDetalhar(e.target.checked)} />
        <span>
          <strong>Tipologias da tabela de vendas (opcional)</strong>
          <span className="block text-xs text-[var(--text-faint)]">
            Cada linha da tabela (metragem, quartos, valor). Pode deixar os quartos em branco quando a tabela só traz a metragem. Imóveis à venda de
            proprietários ficam separados, em &quot;Imóveis disponíveis neste condomínio&quot;.
          </span>
        </span>
      </label>

      {detalhar && (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4">
          {tips.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma tipologia ainda.</p>}
          {tips.map((t, i) => (
            <div key={t.key} className="flex flex-col gap-2 rounded-lg bg-[var(--pill-bg)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">Tipologia {i + 1}</span>
                <button type="button" onClick={() => setTips((prev) => prev.filter((x) => x.key !== t.key))} className="text-xs font-semibold text-red-600 hover:underline">
                  Remover
                </button>
              </div>
              <select className={inputClass} value={t.tipoUnidade} onChange={(e) => updTip(t.key, 'tipoUnidade', e.target.value as TipoUnidade)}>
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
              <ChipSelect label="Quartos (opcional)" options={QUARTO_OPCOES} value={t.quartos} onChange={(x) => updTip(t.key, 'quartos', x === t.quartos ? '' : x)} />
              <ChipSelect label="Vagas (opcional)" options={QUARTO_OPCOES} value={t.vagas} onChange={(x) => updTip(t.key, 'vagas', x === t.vagas ? '' : x)} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className={inputClass} placeholder="Área (m²)" value={t.area} onChange={(e) => updTip(t.key, 'area', e.target.value)} />
                <input className={inputClass} placeholder="Preço" value={maskCurrencyInput(t.priceDigits)} onChange={(e) => updTip(t.key, 'priceDigits', e.target.value)} />
              </div>
              <PhotoUploadField
                label="Planta desta tipologia (opcional, duplex pode ter 2)"
                folder="plantas"
                nomeArquivo={`${f.name} planta ${TIPO_UNIDADE_LABEL[t.tipoUnidade]} ${t.area ? `${t.area} m2` : ''}`}
                modo="plantas"
                compacto
                photos={t.plantas}
                onChange={(x) => updTip(t.key, 'plantas', x)}
                onUploadingChange={setUploading}
              />
            </div>
          ))}
          <button type="button" onClick={addTip} className="self-start rounded-full bg-[var(--pill-bg)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--pill-bg-hover)]">
            + Adicionar tipologia
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.aceitaTemporada} onChange={(e) => set('aceitaTemporada', e.target.checked)} />
          Condomínio aceita temporada
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.video} onChange={(e) => set('video', e.target.checked)} />
          Tem vídeo institucional
        </label>
        {f.video && (
          <>
            <input
              type="url"
              className={inputClass}
              placeholder="Link do YouTube ou Instagram"
              value={f.videoUrl}
              onChange={(e) => {
                const url = e.target.value;
                setF((prev) => ({ ...prev, videoUrl: url, videoVertical: pareceVertical(url) ? true : prev.videoVertical }));
              }}
            />
            <VideoFormato vertical={f.videoVertical} onChange={(x) => set('videoVertical', x)} />
          </>
        )}
      </div>

      <div className="mt-2 rounded-xl border border-[var(--border)] p-4">
        {pendencias.length === 0 ? (
          <p className="text-sm font-semibold text-emerald-700">✓ Tudo pronto para publicar.</p>
        ) : (
          <>
            <p className="text-sm font-semibold">Para publicar, falta:</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-[var(--text-muted)]">
              {pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--text-faint)]">
              Você pode salvar como rascunho e terminar depois. Narrativa, fotos, tipos e lazer são opcionais, dá para publicar e completar depois.
            </p>
          </>
        )}
      </div>

      {faltando.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Ainda não dá para publicar, falta: {faltando.join(', ')}.</p>
      )}
      {duplicado && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Este condomínio já está cadastrado: <strong>{duplicado.name}</strong>
          {duplicado.bairro ? ` (${duplicado.bairro})` : ''}. Para não duplicar, complete o que já existe,{' '}
          <a href={`/dashboard/condominios/${duplicado.id}/editar`} className="font-bold underline">
            abrir o cadastro existente
          </a>
          .
        </p>
      )}
      {erro && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!!saving || uploading || pendencias.length > 0}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          {saving === 'publicado' ? 'Publicando…' : uploading ? 'Aguarde as fotos…' : initial?.status === 'publicado' ? 'Salvar e manter publicado' : 'Publicar'}
        </button>
        <button
          type="button"
          disabled={!!saving || uploading}
          onClick={() => salvar('rascunho')}
          className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--pill-bg)] disabled:opacity-40"
        >
          {saving === 'rascunho' ? 'Salvando…' : initial?.status === 'publicado' ? 'Tirar do ar (voltar para rascunho)' : 'Salvar rascunho'}
        </button>
      </div>
    </form>
  );
}
