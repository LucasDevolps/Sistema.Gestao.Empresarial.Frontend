# Sistema de Gestão Empresarial Hospitalar — Frontend

Frontend Angular do **Sistema de Gestão Empresarial Hospitalar**, conectado ao
backend real em
`C:\Users\lucas\source\repos\Sistema.Gestao.Empresarial.Backend`.

Sem mocks, sem fake API, sem dados fictícios: todo dado de negócio vem da API
HTTP. O backend é a fonte da verdade e a barreira definitiva de autorização; o
frontend apenas representa o que foi autorizado.

- Contrato completo e rastreabilidade feature → endpoint → permissão:
  [`docs/BACKEND-CONTRACT.md`](docs/BACKEND-CONTRACT.md)
- Lacunas do backend, CORS/CSP, Docker/WSL, `npm audit`:
  [`docs/LACUNAS-E-INFRAESTRUTURA.md`](docs/LACUNAS-E-INFRAESTRUTURA.md)

## Stack

| Item | Versão |
|---|---|
| Angular | 20.2 (standalone components, signals, control flow `@if`/`@for`, lazy routes) |
| TypeScript | 5.9, `strict` + `strictTemplates` (nenhum `any`) |
| Estado | Services + RxJS + Signals (sem NgRx — não se justifica hoje) |
| Formulários | Reactive Forms |
| Testes | Karma + Jasmine (`ng test`) |
| Lint | ESLint (`angular-eslint`) |
| Build/serve | `@angular/build` (esbuild) |

Dependências de runtime: apenas os pacotes `@angular/*`, `rxjs`, `tslib`,
`zone.js`. Nenhuma biblioteca de UI/toast/HTTP adicional.

## Requisitos

- Node.js `>= 20.19` ou `>= 22.12` (ver `engines` no `package.json`); testado com Node 22.
- npm 10+.
- Backend em execução e acessível via Nginx (`https://localhost:8443` por padrão no dev).
- Google Chrome instalado para `ng test` (Karma usa `ChromeHeadless`).

## Instalação

```bash
npm ci
```

## Configuração da URL da API

A URL do backend **não** é hardcoded nos services. Ela vem de
`public/config.json`, carregado uma única vez no bootstrap:

```json
{ "apiBaseUrl": "/api", "sessionExpiryWarningSeconds": 120 }
```

- Padrão `"/api"` → chamadas relativas de **mesma origem** (via Nginx), o que
  evita CORS e simplifica o perímetro.
- Para apontar a outra origem em um ambiente específico, publique um
  `config.json` diferente junto ao bundle — sem rebuild.
- `config.json` **não** é cofre de segredo: tudo que vai ao navegador é público.

No desenvolvimento, `ng serve` usa `proxy.conf.json` para encaminhar `/api` e
`/health` ao Nginx do backend:

```json
{ "/api": { "target": "https://localhost:8443", "secure": false, "changeOrigin": true } }
```

Ajuste `target` se o backend estiver em outro host/porta.

## Execução (desenvolvimento)

```bash
npm start
# http://localhost:4200  (proxy → https://localhost:8443)
```

## Build de produção

```bash
npm run build:prod
# saída: dist/sge-frontend/browser
```

O build de produção: sem source maps públicos, `outputHashing: all`,
`inlineCritical: false` (compatível com CSP restritiva sem `style-src` inline por
hash), sem `unsafe-eval` (JIT é só de dev).

## Testes

```bash
npm run test:ci     # headless, one-shot
npm test            # modo watch
```

Cobrem os pontos críticos (spec seções 60–61): `AuthService` (login carrega
`/api/auth/me` antes de liberar o shell; falha de `/me` limpa tokens),
single-flight de refresh, logout com chamada ao backend, `handleForbidden` com
uma única revalidação, interceptor (bearer, 401→refresh→replay único de `GET`,
`POST` não repetido, 403, 429, epoch obsoleto), guards (deny by default),
`HasPermissionDirective`, paginação/omissão de filtros, `DateOnlyPipe`,
mapeamento de `ProblemDetails`.

## Lint

```bash
npm run lint
```

## Estrutura

```
src/app/
  core/
    config/        config runtime (APP_CONFIG, loadAppConfig)
    models/        contratos HTTP tipados (auth, employee, organization, catalog, user, permission)
    http/          buildParams (omite vazios), api-error (ProblemDetails → mensagem segura)
    auth/          TokenStore (memória), AuthStore (signals), AuthService, interceptor, guards
    notifications/ NotificationService
    ui/            LoadingService + loadingInterceptor
  shared/
    directives/    *appHasPermission (deny by default, reativo)
    components/     toast-host, paginator, status-badge
    pipes/          dateOnly (YYYY-MM-DD → DD/MM/YYYY, sem fuso)
  layout/          shell (sidebar + header, menu por permissão)
  features/
    auth/          login
    home/          página inicial (sem métricas fictícias)
    employees/     lista, detalhe, formulário, 9 endpoints + vínculos
    catalogs/      profissões e cargos (genérico), níveis (somente leitura)
    organization/  unidades e setores (somente leitura)
    users/         lista + administração de permissões
```

## Segurança — resumo do que o frontend faz e não faz

- **Tokens só em memória** (`TokenStore`): `accessToken`, `refreshToken`,
  `sessionId` nunca vão para `localStorage`/`sessionStorage`/IndexedDB/cookie
  criado por JS/URL. Reload = sessão local perdida → login.
- **`/api/auth/me` antes do shell**: identidade, organização e permissões
  efetivas são carregadas de `/api/auth/me`; permissões **não** são derivadas do
  JWT. O snapshot é substituído por inteiro a cada revalidação.
- **Deny by default**: menus, rotas (`permissionGuard`) e botões
  (`*appHasPermission`) escondem o que não pode ser comprovado. Isso é UX — o
  backend continua negando.
- **Interceptor**: um `401` dispara um único refresh compartilhado; só `GET` é
  repetido, uma vez. `POST/PUT/PATCH` nunca são repetidos. `login`/`refresh`/
  `logout`/`me` não entram no laço de refresh. Sem loop `401→refresh→401`.
- **403**: deny by default + no máximo uma revalidação de `/api/auth/me`.
- **429**: respeita `Retry-After`, avisa, não repete. Botões de submit ficam
  bloqueados durante a operação (proteção a duplo clique).
- **Logout**: chama `POST /api/auth/logout`; limpa identidade/permissões/tokens/
  caches em memória mesmo se a chamada falhar; respostas pendentes de uma sessão
  anterior são descartadas (epoch).
- **XSS**: sem `innerHTML`/`bypassSecurityTrust*`/`eval`; sanitização do Angular
  intacta; nenhum HTML arbitrário da API é renderizado.
- **Logs**: nada de token/senha/headers `Authorization`/objetos de sessão no
  console; sem `console.log` de diagnóstico em produção.
- **Sem segredos** no bundle nem na documentação.

Detalhes de CORS, CSP, cookie HttpOnly e Docker: `docs/LACUNAS-E-INFRAESTRUTURA.md`.

## Docker (opcional)

Artefatos prontos: `Dockerfile` (multi-stage, runtime `nginx-unprivileged`
não-root, `read_only`), `docker/nginx.conf` (SPA + CSP compatível + reverse proxy
de `/api` e `/health`), `docker/entrypoint.sh`, `docker-compose.yml` (composição
**isolada** do frontend, publica só em `127.0.0.1:8082`).

> Rodar sempre dentro do WSL 2 (`Ubuntu`), nunca no PowerShell/Windows:
> ```powershell
> wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/lucas/source/repos/Sistema.Gestao.Empresarial.Frontend && docker compose config --quiet'
> wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/lucas/source/repos/Sistema.Gestao.Empresarial.Frontend && docker compose up -d --build'
> ```
> Validado no WSL 2 (`Ubuntu`): build + `up` OK, container `healthy` em
> `http://127.0.0.1:8082`, não-root + `read_only` + `cap_drop: ALL`. `/api` faz
> proxy para `API_UPSTREAM` (defina em `.env` ou `SGE_FRONTEND_API_UPSTREAM`).
> Ver `docs/LACUNAS-E-INFRAESTRUTURA.md` §6.

## Identidade visual

Inspirada na BP – A Beneficência Portuguesa de São Paulo (roxo institucional +
laranja de destaque, branco, neutros claros). **Não** havia manual de marca /
design system de primeira mão disponível no momento do build, portanto os tons em
`src/styles.scss` (tokens `--color-*`) são uma **aproximação documentada** — basta
trocar os tokens se um design system oficial for fornecido. Dark mode não foi
implementado (não é prioridade).
