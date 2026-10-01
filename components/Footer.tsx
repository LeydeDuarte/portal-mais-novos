import { MAIS_VALOR_URL } from '@/lib/marca';
import Logo from './Logo';
import { DASHBOARD_URL } from '@/lib/dominios';

export default function Footer() {
  return (
    <footer className="flex flex-col gap-5 border-t border-[var(--border)] px-5 pb-6 pt-8 md:px-8 md:pt-11 md:pb-7">
      <div className="flex flex-wrap justify-between gap-7">
        <div className="flex max-w-[320px] flex-col gap-2">
          <Logo tipo="completo" altura={44} />
          <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
            Os mais novos imóveis à venda estão aqui: residenciais, comerciais, lançamentos, imóveis novos e casas em condomínio.
          </p>
          {/* selo ANEPS e a marca de crédito (Mais Valor Capital) */}
          <div className="mt-2 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/selo-aneps.webp" alt="Profissional certificado ANEPS" width={64} height={64} className="h-16 w-16" loading="lazy" />
            <a href={MAIS_VALOR_URL} target="_blank" rel="noopener" className="rounded-xl bg-white px-2.5 py-1.5" title="Mais Valor Capital: crédito e financiamento imobiliário">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marca/mais-valor-capital.webp" alt="Mais Valor Capital" width={150} height={35} className="h-[35px] w-auto" loading="lazy" />
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">Navegação</span>
          {[
            { label: 'Comprar', href: '/' },
            { label: 'Lançamentos', href: '/lancamentos' },
            { label: 'Financiamento', href: '/financiamento' },
            { label: 'Imóveis por bairro', href: '/imoveis-a-venda' },
            { label: 'Construtoras e incorporadoras', href: '/empresas' },
            { label: 'Venda seu imóvel', href: '/vender' },
            { label: 'Quem somos', href: '/quem-somos' },
            { label: 'Mais Valor Capital (crédito)', href: MAIS_VALOR_URL }
          ].map(({ label, href }) => (
            <a key={label} href={href} className="text-[13px] text-[var(--text-muted)]">
              {label}
            </a>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">Contato</span>
          <p className="text-[13px] text-[var(--text-muted)]">Goiânia, Goiás, Brasil</p>
          <a href="https://www.instagram.com/leydeduarte.br" target="_blank" rel="noopener" className="text-[13px] text-[var(--text-muted)]">
            Instagram @leydeduarte.br
          </a>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-1.5 border-t border-[var(--border)] pt-4 text-[11px] text-[var(--text-faint)]">
        <span>
          © 2026 Mais Novos Inteligência Imobiliária · CNPJ 36.006.396/0001-21 ·{' '}
          <a href={DASHBOARD_URL} rel="nofollow" className="hover:text-[var(--text-muted)] hover:underline">
            Área restrita
          </a>
        </span>
        <span>
          CRECI C17586 · Correspondente bancário 185260817022749
        </span>
      </div>
      {/* informações legais da empresa, das certificações e da Mais Valor Capital */}
      <div className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
        <p>
          Mais Novos Inteligência Imobiliária, CNPJ 36.006.396/0001-21, CRECI 17586 e Correspondente Bancária 185260817022749, com sede na Rua T-37, Setor Bueno, Goiânia, Goiás.
        </p>
        <p>
          A Mais Novos Inteligência Imobiliária possui certificação pela ANEPS, Associação Nacional das Empresas Promotoras de Crédito e Correspondentes no País, e atende aos requisitos da Resolução nº 4.935/21 do Conselho Monetário Nacional (CMN). Certificação PLDFT nº 0185260819071443. Certificação Crédito Imobiliário nº 0185260817022749. CJ 38746. CF 17586. Representando o setor de crédito e financiamento da Mais Novos, a marca comercial Mais Valor Capital, no endereço{' '}
          <a href="https://maisvalorcapital.com.br" target="_blank" rel="noopener" className="underline hover:text-[var(--text-muted)]">
            maisvalorcapital.com.br
          </a>
          . Atuamos como correspondente OXY nos serviços de Home Equity, Financiamento Imobiliário e Financiamento de Construção.
        </p>
      </div>
    </footer>
  );
}
