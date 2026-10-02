'use client';

// "Posição do sol" no perfil do condomínio. Para ver, o visitante entra com o Google
// (é o principal motivo para entrar). O cálculo é astronômico, feito no navegador
// (SunCalc), sem custo. Desenho tipo "cúpula do céu" vista de cima: a borda é o
// horizonte, o centro é o sol a pino; quanto mais alto o sol, mais perto do centro.
import { useMemo, useState } from 'react';
import * as SunCalc from 'suncalc';
import LoginModal from '@/components/LoginModal';
import BotaoWhatsapp, { type WhatsappContexto } from '@/components/BotaoWhatsapp';
import { useSession } from '@/lib/use-session';
import { useStaffSession } from '@/lib/use-staff-session';
import MapaFundoSol from '@/components/MapaFundoSol';

const FUSO = 3; // Goiânia: UTC-3, sem horário de verão
type Dia = 'hoje' | 'inverno' | 'verao';
const C = 130; // centro do desenho
const R = 110; // raio = horizonte

function dataDoDia(dia: Dia) {
  const agora = new Date(Date.now() - FUSO * 3600000);
  const y = agora.getUTCFullYear();
  if (dia === 'inverno') return { y, m: 5, d: 21 };
  if (dia === 'verao') return { y, m: 11, d: 21 };
  return { y, m: agora.getUTCMonth(), d: agora.getUTCDate() };
}
const instante = (dia: { y: number; m: number; d: number }, minutos: number) => new Date(Date.UTC(dia.y, dia.m, dia.d, 0, 0) + (minutos + FUSO * 60) * 60000);
const hora = (dt: Date) => dt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
function rumo(az: number) {
  return ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'][Math.round((((az % 360) + 360) % 360) / 45) % 8];
}
/** posição no desenho: azimute (graus, a partir do norte) e altura (graus) */
function xy(az: number, alt: number, raio = R): [number, number] {
  const d = raio * (1 - Math.max(0, alt) / 90);
  const r = (az * Math.PI) / 180;
  return [C + d * Math.sin(r), C - d * Math.cos(r)];
}
function caminho(lat: number, lng: number, dia: Dia): string {
  const dd = dataDoDia(dia);
  const pts: string[] = [];
  for (let min = 4 * 60; min <= 20 * 60; min += 10) {
    const p = SunCalc.getPosition(instante(dd, min), lat, lng);
    if (p.altitude < 0) continue;
    const [x, y] = xy(p.azimuth, p.altitude);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.length ? `M${pts.join(' L')}` : '';
}

export default function PosicaoSol({
  lat,
  lng,
  nome,
  whats,
  aproximado = false
}: {
  lat: number;
  lng: number;
  nome: string;
  whats: WhatsappContexto;
  /** posição arredondada (anúncio de rua): mostra a região, sem marcar o ponto */
  aproximado?: boolean;
}) {
  const { session, signIn } = useSession();
  // equipe logada no painel vê direto, sem precisar do login do Google
  const { staff } = useStaffSession();
  const loggedIn = session.loggedIn || !!staff;
  const [login, setLogin] = useState(false);
  const [dia, setDia] = useState<Dia>('hoje');
  const [min, setMin] = useState(() => {
    const a = new Date(Date.now() - FUSO * 3600000);
    const m = a.getUTCHours() * 60 + a.getUTCMinutes();
    return m >= 6 * 60 && m <= 18 * 60 ? m - (m % 10) : 14 * 60 + 30;
  });

  const calc = useMemo(() => {
    const dd = dataDoDia(dia);
    const t = SunCalc.getTimes(instante(dd, 12 * 60), lat, lng);
    const nasce = t.sunrise ?? instante(dd, 6 * 60);
    const poe = t.sunset ?? instante(dd, 18 * 60);
    const azN = SunCalc.getPosition(nasce, lat, lng).azimuth;
    const azP = SunCalc.getPosition(poe, lat, lng).azimuth;
    const agora = SunCalc.getPosition(instante(dd, min), lat, lng);
    const meioDia = SunCalc.getPosition(t.solarNoon ?? instante(dd, 12 * 60), lat, lng);
    return {
      dia: caminho(lat, lng, dia),
      inverno: dia === 'inverno' ? '' : caminho(lat, lng, 'inverno'),
      verao: dia === 'verao' ? '' : caminho(lat, lng, 'verao'),
      nascer: xy(azN, 0),
      por: xy(azP, 0),
      sol: agora.altitude > 0 ? xy(agora.azimuth, agora.altitude) : null,
      texto: {
        nascer: `${hora(nasce)}, a ${rumo(azN)}`,
        por: `${hora(poe)}, a ${rumo(azP)}`,
        meioDia: `${Math.round(meioDia.altitude)}° de altura, ${meioDia.azimuth > 90 && meioDia.azimuth < 270 ? 'um pouco ao sul' : 'ao norte'}`,
        agora: agora.altitude > 0 ? `O sol está a ${Math.round(agora.altitude)}° de altura, vindo do ${rumo(agora.azimuth)}.` : 'O sol está abaixo do horizonte nesse horário.'
      }
    };
  }, [lat, lng, dia, min]);

  const titulo = (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FFF4D6] text-[18px]" aria-hidden>
        ☀
      </span>
      <div>
        <h2 className="text-lg font-bold leading-tight">Posição do sol</h2>
        <p className="text-[13px] text-[var(--text-muted)]">Onde bate o sol no {nome} em cada estação e horário</p>
      </div>
    </div>
  );

  // sem login: prévia desfocada + convite
  if (!loggedIn)
    return (
      <section className="mt-8 rounded-[20px] border border-[var(--border)] p-5">
        {titulo}
        <div className="relative mt-4 overflow-hidden rounded-2xl bg-[#FFFBEB]">
          <svg viewBox="0 0 260 260" className="mx-auto block h-[220px] w-[220px] blur-[3px]" aria-hidden>
            <circle cx={C} cy={C} r={R} fill="none" stroke="#D6B66E" strokeWidth="1.5" strokeDasharray="5 5" />
            <path d={calc.inverno || caminho(lat, lng, 'inverno')} stroke="#3B82F6" strokeWidth="3" fill="none" />
            <path d={calc.dia} stroke="#F59E0B" strokeWidth="6" fill="none" />
            {calc.sol && <circle cx={calc.sol[0]} cy={calc.sol[1]} r="11" fill="#FBBF24" stroke="#fff" strokeWidth="3" />}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/40 p-4 text-center">
            <p className="max-w-[340px] text-[14px] font-semibold text-[#14161A]">Veja o caminho do sol no inverno e no verão, a hora em que ele nasce e se põe e qual face do prédio recebe sol.</p>
            <button
              type="button"
              data-rastro="sol"
              data-rastro-ref={nome}
              onClick={() => setLogin(true)}
              className="h-11 rounded-full bg-[#14161A] px-5 text-[14px] font-bold text-white hover:brightness-110"
            >
              Entrar com o Google para ver
            </button>
            <span className="text-[11.5px] text-[#5B6068]">Grátis, sem senha, em um toque.</span>
          </div>
        </div>
        <LoginModal
          open={login}
          onClose={() => setLogin(false)}
          titulo="Entre para ver a posição do sol"
          texto="É grátis e leva 5 segundos. Você também pode salvar imóveis nos favoritos."
          onSignIn={(c) => {
            signIn(c);
            setLogin(false);
          }}
        />
      </section>
    );

  return (
    <section className="mt-8 rounded-[20px] border border-[var(--border)] p-5">
      {titulo}
      <div className="mt-4 grid gap-5 sm:grid-cols-[300px_minmax(0,1fr)] sm:items-center">
        <figure className="m-0">
          <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-2xl border border-[var(--border)]">
            {/* mapa de verdade atrás do desenho: ruas e nomes, para a pessoa se localizar */}
            <MapaFundoSol lat={lat} lng={lng} zoom={aproximado ? 14 : 16.6} />
            <svg viewBox="0 0 260 260" className="absolute inset-0 h-full w-full" role="img" aria-label={`Caminho do sol sobre o ${nome}`}>
              {/* fora do círculo um véu claro; dentro, o mapa aparece */}
              <path d={`M0 0H260V260H0Z M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`} fill="rgba(255,255,255,0.55)" fillRule="evenodd" />
              <circle cx={C} cy={C} r={R} fill="rgba(255,251,235,0.18)" stroke="#B45309" strokeWidth="1.5" strokeDasharray="5 5" />
              <g fill="none" strokeLinecap="round">
                {calc.inverno && <path d={calc.inverno} stroke="#fff" strokeWidth="5.5" opacity="0.9" />}
                {calc.inverno && <path d={calc.inverno} stroke="#3B82F6" strokeWidth="2.8" />}
                {calc.verao && <path d={calc.verao} stroke="#fff" strokeWidth="5.5" opacity="0.9" />}
                {calc.verao && <path d={calc.verao} stroke="#DC2626" strokeWidth="2.8" />}
                <line x1={C} y1={C} x2={calc.nascer[0]} y2={calc.nascer[1]} stroke="#F59E0B" strokeWidth="2.2" strokeDasharray="3 4" />
                <line x1={C} y1={C} x2={calc.por[0]} y2={calc.por[1]} stroke="#B45309" strokeWidth="2.2" strokeDasharray="3 4" />
                <path d={calc.dia} stroke="#fff" strokeWidth="8" opacity="0.95" />
                <path d={calc.dia} stroke="#F59E0B" strokeWidth="5" />
              </g>
              {aproximado ? (
                <circle cx={C} cy={C} r="16" fill="rgba(26,95,208,0.18)" stroke="#1A5FD0" strokeWidth="2" strokeDasharray="4 3" />
              ) : (
                <rect x={C - 10} y={C - 10} width="20" height="20" rx="3" fill="#1A5FD0" stroke="#fff" strokeWidth="2.5" />
              )}
              {calc.sol && <circle cx={calc.sol[0]} cy={calc.sol[1]} r="11" fill="#FBBF24" stroke="#fff" strokeWidth="3" />}
              <g fontSize="15" fontWeight="800" fill="#14161A" textAnchor="middle" stroke="#fff" strokeWidth="3.5" paintOrder="stroke">
                <text x={C} y="15">N</text>
                <text x="251" y={C + 5}>L</text>
                <text x={C} y="255">S</text>
                <text x="9" y={C + 5}>O</text>
              </g>
            </svg>
          </div>
          <figcaption className="mt-1.5 text-center text-[11.5px] text-[var(--text-muted)]">
            {aproximado ? 'Região aproximada do imóvel' : <><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[#1A5FD0] align-middle" /> {nome} no mapa</>}
          </figcaption>
        </figure>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['hoje', 'Hoje'],
                ['inverno', 'Inverno (21/jun)'],
                ['verao', 'Verão (21/dez)']
              ] as [Dia, string][]
            ).map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => setDia(v)}
                className={`h-9 rounded-full px-3.5 text-[13px] font-semibold ${dia === v ? 'bg-accent text-white' : 'border border-[var(--border)]'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3">
            <span className="w-12 text-[15px] font-bold tabular-nums">
              {String(Math.floor(min / 60)).padStart(2, '0')}:{String(min % 60).padStart(2, '0')}
            </span>
            <input type="range" min={5 * 60} max={19 * 60 + 30} step={10} value={min} onChange={(e) => setMin(Number(e.target.value))} className="flex-1 accent-[#F59E0B]" aria-label="Horário" />
          </label>
          <p className="text-[13.5px]">{calc.texto.agora}</p>
          <ul className="flex flex-col gap-1 text-[13px] text-[var(--text-muted)]">
            <li>
              Nasce às <b className="text-[var(--text)]">{calc.texto.nascer}</b> e se põe às <b className="text-[var(--text)]">{calc.texto.por}</b>.
            </li>
            <li>Ao meio-dia: {calc.texto.meioDia}.</li>
          </ul>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-muted)]">
            <span>
              <b style={{ color: '#F59E0B' }}>━</b> dia escolhido
            </span>
            <span>
              <b style={{ color: '#3B82F6' }}>━</b> inverno
            </span>
            <span>
              <b style={{ color: '#DC2626' }}>━</b> verão
            </span>
            <span>borda = horizonte · centro = sol a pino</span>
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Face norte', 'sol na maior parte do ano'],
          ['Face leste', 'sol da manhã'],
          ['Face oeste', 'sol da tarde, mais quente'],
          ['Face sul', 'sol direto só no verão']
        ].map(([f, t]) => (
          <div key={f} className="rounded-xl bg-[var(--pill-bg)] p-3 text-[12.5px]">
            <b>{f}</b>
            <br />
            {t}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <BotaoWhatsapp ctx={whats} variante="bloco" rotulo="Qual unidade pega o sol que eu prefiro?" />
      </div>
    </section>
  );
}
