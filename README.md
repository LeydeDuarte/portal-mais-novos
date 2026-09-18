# Portal Mais Novos Imóveis — Home

Protótipo funcional da Home em Next.js 14 (App Router) + Tailwind CSS, portado do
protótipo HTML original. Feed masonry estilo Pinterest, scroll infinito, favoritos
com login sob demanda (Google, mockado) e autoplay rotativo dos vídeos de capa.

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em http://localhost:3000

## Subir para o GitHub

```bash
git init
git add .
git commit -m "Home inicial — feed masonry, scroll infinito, favoritos, autoplay rotativo"
git branch -M main
git remote add origin https://github.com/<seu-usuario>/portal-mais-novos-imoveis.git
git push -u origin main
```

(Crie o repositório vazio no GitHub antes do `git remote add`, sem README/gitignore
pré-criados, para evitar conflito no primeiro push.)

## Deploy

Depois do repositório no GitHub, conectar em vercel.com (ou `vercel` via CLI) —
o Next.js é detectado automaticamente, sem configuração extra.

## O que já está implementado

- Feed masonry responsivo (2 colunas no celular, até 6 em telas grandes)
- Scroll infinito por lotes (`IntersectionObserver`), sem carregar o catálogo inteiro
- Favoritos com login sob demanda (só pede login ao tentar favoritar)
- Autoplay rotativo dos vídeos de capa (no máx. 3 tocando ao mesmo tempo, priorizado por
  `matchScore` — hoje mockado, na versão real vem do motor de recomendação)
- Log de interação (tempo de permanência por imóvel) em `localStorage`, como protótipo
  da tabela `interaction` real

## O que ainda é mock/placeholder

- Fotos e vídeos são placeholders (`[FOTO]` / `[CAPA EM VÍDEO]`) — sem asset real ainda
- Dados dos imóveis são fixos em `lib/mock-properties.ts`, cicla o mesmo dataset a cada
  página do scroll infinito
- Login é simulado (`lib/use-session.ts`) — trocar por Google Identity Services + backend
  de verdade quando a API estiver pronta
- Não há backend/API — é só a camada visual da Home

Arquitetura completa (banco de dados, RBAC, motor de recomendação, módulo de IA de
cadastro, deduplicação, LGPD) está no documento de arquitetura do projeto.
