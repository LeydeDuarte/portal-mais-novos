'use client';

import { useMemo, useRef, useState } from 'react';
import { createDevelopment, type CondominioResumo } from '@/lib/actions';
import CepField, { ENDERECO_VAZIO, formatLocation, type Endereco } from '@/components/CepField';
import AmenitiesCheckboxes from '@/components/AmenitiesCheckboxes';

const inputClass = 'w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none';

function normalize(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

type Props = {
  condominios: CondominioResumo[];
  selectedId: string;
  onSelect: (c: CondominioResumo | null) => void;
  onCreated: (c: CondominioResumo) => void;
  cidade?: string; // do CEP do imóvel, prioriza condomínios da mesma cidade (e bairro)
  bairro?: string;
  textoInicial?: string; // nome lido do anúncio (preenchimento rápido), já aparece digitado
};

const RECENTES_KEY = 'mn_condos_recentes';
function lerRecentes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTES_KEY) || '[]');
  } catch {
    return [];
  }
}
function guardarRecente(id: string) {
  try {
    localStorage.setItem(RECENTES_KEY, JSON.stringify([id, ...lerRecentes().filter((x) => x !== id)].slice(0, 10)));
  } catch {
    // ignora
  }
}

// Campo "Este imóvel fica em qual condomínio?": digita parte do nome e vai
// filtrando os condomínios já cadastrados. Se não existir, cadastra ali mesmo
// (nome, endereço, tipo e lazer) — ele nasce como RASCUNHO, sem aparecer no
// site, até alguém finalizar e publicar em Painel → Condomínios.
export default function CondominioPicker({ condominios, selectedId, onSelect: onSelectRaw, onCreated, cidade = '', bairro = '', textoInicial = '' }: Props) {
  const onSelect = (c: CondominioResumo | null) => {
    if (c) guardarRecente(c.id);
    onSelectRaw(c);
  };
  const selected = condominios.find((c) => c.id === selectedId) ?? null;
  const [text, setText] = useState(textoInicial);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sem digitar nada: só os 3 últimos usados (ou os 3 mais recentes cadastrados).
  // Digitando: condomínios com esse nome, primeiro os da mesma cidade/bairro do CEP —
  // com endereço à mostra, porque muitos nomes se repetem em lugares diferentes.
  const matches = useMemo(() => {
    const tokens = normalize(text).split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      const rec = lerRecentes()
        .map((id) => condominios.find((c) => c.id === id))
        .filter((c): c is CondominioResumo => !!c);
      const novos = [...condominios].sort((a, b) => (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''));
      return Array.from(new Set([...rec, ...novos])).slice(0, 3);
    }
    const cid = normalize(cidade);
    const bai = normalize(bairro);
    return condominios
      .filter((c) => tokens.every((t) => normalize(c.name).includes(t) || normalize(`${c.bairro ?? ''} ${c.cidade ?? ''}`).includes(t)))
      .map((c) => {
        const nome = normalize(c.name);
        let score = tokens.every((t) => nome.includes(t)) ? 0 : 5;
        if (nome.startsWith(tokens[0])) score -= 1;
        if (cid && normalize(c.cidade ?? '') !== cid) score += 10;
        if (bai && normalize(c.bairro ?? '') === bai) score -= 2;
        return { c, score };
      })
      .sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name))
      .slice(0, 8)
      .map((x) => x.c);
  }, [text, condominios, cidade, bairro]);
  const semTexto = !text.trim();

  // ---- mini cadastro ----
  const [novo, setNovo] = useState({ name: '', endereco: ENDERECO_VAZIO as Endereco, tipo: 'vertical' as 'vertical' | 'horizontal', amenities: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const startCreate = () => {
    setNovo((n) => ({ ...n, name: text.trim(), endereco: n.endereco.cidade ? n.endereco : { ...ENDERECO_VAZIO, cidade, bairro } }));
    setCreating(true);
    setOpen(false);
  };

  const saveNovo = async () => {
    setErro(null);
    if (!novo.name.trim()) return setErro('Digite o nome do condomínio.');
    if (!novo.endereco.bairro || !novo.endereco.cidade) return setErro('Informe o CEP (ou bairro e cidade) do condomínio.');
    const jaExiste = condominios.find((c) => normalize(c.name) === normalize(novo.name) && normalize(c.cidade ?? '') === normalize(novo.endereco.cidade));
    if (jaExiste) {
      onSelect(jaExiste);
      setCreating(false);
      return;
    }
    setSaving(true);
    const id = `condo-${Date.now()}`;
    const location = formatLocation(novo.endereco);
    try {
      const r = await createDevelopment({
        id,
        name: novo.name.trim(),
        location,
        description: '',
        tipo: novo.tipo,
        amenities: novo.amenities,
        aceitaTemporada: false,
        status: 'rascunho',
        ...novo.endereco
      });
      if (!r.ok && r.duplicado) {
        // já existe: usa o cadastrado em vez de criar outro
        const existente = condominios.find((c) => c.id === r.duplicado!.id);
        if (existente) onSelect(existente);
        else setErro(`Já existe o condomínio ${r.duplicado.name}${r.duplicado.bairro ? ` (${r.duplicado.bairro})` : ''}, procure pelo nome acima.`);
        setCreating(false);
        return;
      }
      const resumo: CondominioResumo = {
        id,
        name: novo.name.trim(),
        bairro: novo.endereco.bairro,
        cidade: novo.endereco.cidade,
        uf: novo.endereco.uf,
        cep: novo.endereco.cep,
        logradouro: novo.endereco.logradouro,
        status: 'rascunho',
        amenities: novo.amenities,
        deliveryDate: null,
        anuncios: 0,
        tipologias: 0,
        temFotos: false,
        corretorEmail: null
      };
      onCreated(resumo);
      setCreating(false);
      setText('');
    } catch {
      setErro('Não foi possível cadastrar o condomínio agora. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[var(--text-muted)]">Este imóvel fica em um condomínio? (opcional)</label>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-ink bg-[var(--pill-bg)] px-3 py-2.5">
          <span className="text-sm">
            <strong>{selected.name}</strong>
            <span className="text-[var(--text-muted)]">, {[selected.bairro, selected.cidade].filter(Boolean).join(', ')}</span>
            {selected.status === 'rascunho' && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">rascunho</span>
            )}
          </span>
          <button type="button" onClick={() => onSelect(null)} className="shrink-0 text-xs font-semibold text-[var(--text-muted)] hover:underline">
            Trocar
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            className={inputClass}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setOpen(false), 150);
            }}
            placeholder="Digite parte do nome do condomínio, ex: “jardins”, “alphaville”"
          />
          {open && (
            <div
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1 shadow-xl"
              onMouseDown={() => blurTimer.current && clearTimeout(blurTimer.current)}
            >
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                {semTexto ? 'Últimos usados, digite para buscar' : cidade ? `Resultados (primeiro os de ${cidade})` : 'Resultados, preencha o CEP para priorizar a cidade'}
              </p>
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                    setText('');
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--pill-bg)]"
                >
                  <span className="min-w-0">
                    <strong>{c.name}</strong>
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                      {[c.logradouro, c.bairro, [c.cidade, c.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Endereço não informado'}
                    </span>
                  </span>
                  {cidade && c.cidade && normalize(c.cidade) !== normalize(cidade) && (
                    <span className="shrink-0 rounded bg-[var(--pill-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--text-muted)]">outra cidade</span>
                  )}
                  {c.status === 'rascunho' && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">rascunho</span>}
                </button>
              ))}
              {matches.length === 0 && (
                <p className="px-3 py-2 text-sm text-[var(--text-muted)]">{semTexto ? 'Digite o nome do condomínio.' : 'Nenhum condomínio com esse nome ainda.'}</p>
              )}
              <button
                type="button"
                onClick={startCreate}
                className="mt-1 w-full rounded-lg border-t border-[var(--border)] px-3 py-2.5 text-left text-sm font-bold text-accent hover:bg-[var(--pill-bg)]"
              >
                + Cadastrar {text.trim() ? `“${text.trim()}”` : 'um condomínio novo'}
              </button>
            </div>
          )}
        </div>
      )}
      <span className="text-xs text-[var(--text-faint)]">Deixe em branco se for um imóvel de rua (fora de condomínio).</span>

      {creating && (
        <div className="mt-2 flex flex-col gap-3 rounded-xl border-2 border-dashed border-accent/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Novo condomínio</span>
            <button type="button" onClick={() => setCreating(false)} className="text-xs font-semibold text-[var(--text-muted)] hover:underline">
              Cancelar
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Fica salvo como <strong>rascunho</strong> (não aparece no site). Para publicar a página do condomínio, finalize depois em Painel → Condomínios.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Nome do condomínio</label>
            <input className={inputClass} value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} placeholder="Residencial Bueno" />
          </div>
          <CepField value={novo.endereco} onChange={(v) => setNovo({ ...novo, endereco: v })} modo="empreendimento" />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Tipo de condomínio</label>
            <select className={inputClass} value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as 'vertical' | 'horizontal' })}>
              <option value="vertical">Vertical (prédio/torre)</option>
              <option value="horizontal">Horizontal (casas/lotes)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Lazer do condomínio</label>
            <AmenitiesCheckboxes selected={novo.amenities} onChange={(v) => setNovo({ ...novo, amenities: v })} />
          </div>
          {erro && <p className="text-sm font-semibold text-red-600">{erro}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={saveNovo}
            className="self-start rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar condomínio e usar neste imóvel'}
          </button>
        </div>
      )}
    </div>
  );
}
