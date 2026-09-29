# Portal Mais Novos Imóveis

Protótipo funcional em Next.js 14 (App Router) + Tailwind CSS. Feed masonry
estilo Pinterest, scroll infinito, favoritos com login sob demanda (Google,
mockado), autoplay rotativo dos vídeos de capa, filtros funcionais, páginas de
imóvel e empreendimento com SEO real (metadata, dados estruturados, sitemap),
e painel do corretor/admin com cadastro manual (imóvel avulso ou condomínio,
com vínculo entre os dois).

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em http://localhost:3000

## Subir para o GitHub / atualizar

Sempre o mesmo processo (ver instruções que já foram passadas na conversa):
extrair o zip por cima da pasta existente, `git add .` (digitando na mão),
`git commit`, `git push`.

## O que já está implementado

**Vitrine**
- Feed masonry responsivo (2 colunas no celular, até 6 em telas grandes) com scroll infinito por lotes
- Favoritos com login sob demanda (só pede login ao tentar favoritar)
- Autoplay rotativo dos vídeos de capa (máx. 3 tocando ao mesmo tempo, priorizado por afinidade de perfil)
- Filtros funcionais: finalidade, tipo de imóvel, preço, quartos, vagas, situação (lançamento/seminovo/usado), aceita temporada
- Classificação automática lançamento/seminovo/usado calculada pela data de entrega — nunca cadastrada à mão
- Etiqueta com o ano de entrega, cor por período
- Selo "Aceita temporada"
- Taxonomia fechada de 18 tipos de imóvel (apartamento, cobertura, penthouse, casa em condomínio, sala comercial etc.)

**Páginas de detalhe**
- `/imovel/[id]` — galeria (com embed real de vídeo do YouTube/Instagram quando cadastrado), descrição, comodidades, especificações completas (quartos/vagas/banheiros/área), favoritar, formulário de contato, unidades irmãs do mesmo empreendimento
- `/empreendimento/[id]` — tipo vertical/horizontal, pavimentos ou área do terreno, preço médio do m² calculado, lazer, lista de tipologias/unidades vinculadas
- `/lancamentos` — lista só os empreendimentos cuja entrega ainda não passou

**SEO**
- `generateMetadata` por página (title, description, Open Graph, canonical) para cada imóvel e empreendimento do catálogo
- Dados estruturados JSON-LD (schema.org `RealEstateListing`, `ApartmentComplex`/`Residence`, `RealEstateAgent` da empresa)
- `sitemap.xml` e `robots.txt` gerados automaticamente a partir do catálogo
- Páginas do catálogo de exemplo são pré-renderizadas no build (`generateStaticParams`) — HTML completo já pronto, sem esperar nada
- `/painel` marcado como `noindex` e bloqueado no robots.txt (área interna, não deve aparecer no Google)

**Painel do corretor/admin** (`/painel`)
- Login próprio da equipe, separado do login de cliente (`/painel/login`)
- RBAC: admin vê tudo, corretor só vê o que ele mesmo cadastrou
- Cadastro de imóvel avulso OU de empreendimento/condomínio, com:
  - Vínculo opcional entre imóvel avulso e um condomínio já cadastrado (reúne os anúncios na página do condomínio)
  - Quartos/vagas/banheiros por seleção (1 a 5+), não texto livre
  - Comodidades por checkbox (lista fechada de 18 itens)
  - Máscara de moeda no preço
  - Link de vídeo (YouTube/Instagram) com embed real na capa

## Banco de dados

O catálogo de imóveis e empreendimentos, o login da equipe e o cadastro
(manual e por IA) agora usam um banco Postgres real (Neon), não mais o
localStorage do navegador — qualquer pessoa que visitar o site já vê os
mesmos imóveis, de qualquer navegador/computador. Requer a variável de
ambiente `DATABASE_URL` configurada (já está na Vercel).

## O que ainda é mock/placeholder

- Fotos são placeholders (`[FOTO]`) — sem upload de imagem ainda (fica combinado pra entrar junto do módulo de IA)
- Painel de monitoramento de mercado (leads) ainda usa localStorage
- Login de cliente (Google) continua simulado — favoritos ainda ficam no localStorage
- Login da equipe (admin/corretor) já é real: senha verificada contra o banco, sessão em cookie assinado
- Dados dos imóveis de exemplo são fixos em `lib/mock-properties.ts` e `lib/property-details.ts`

## Próximos passos (roadmap combinado)

1. Cadastro assistido por IA (upload de PDF/fotos, extração automática) — precisa de backend real
2. Painel de monitoramento de mercado (imóveis recém-anunciados por cidade)
3. Trocar o localStorage por API + banco de dados de verdade (arquitetura completa já desenhada no documento de arquitetura do projeto)

Documento de arquitetura completo (banco de dados, RBAC, motor de recomendação,
módulo de IA de cadastro, deduplicação, LGPD) está no artefato do projeto.
