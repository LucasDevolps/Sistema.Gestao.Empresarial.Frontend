# Lacunas do backend e notas de infraestrutura

Documento exigido pelas seções 1, 45, 53, 55 e 56 do prompt. Nada aqui foi
“resolvido” alterando o backend ou simulando recursos.

## 1. Recursos que o backend ainda não expõe

| Necessidade | Situação atual | Efeito no frontend |
|---|---|---|
| Cookie HttpOnly para refresh/sessão | Não implementado. `login`/`refresh` devolvem `accessToken`, `refreshToken`, `sessionId`, `userGuid` no corpo JSON. | Tokens e `sessionId` ficam **somente em memória volátil** (`TokenStore`). Recarregar/fechar a aba encerra a sessão local e leva ao login. Restauração segura após reload depende de mudança explícita do backend para cookie `HttpOnly; Secure; SameSite` + proteção CSRF compatível. |
| Catálogo completo de permissões | Não há endpoint. | A tela de permissões usa a lista de códigos conhecidos (`permission.model.ts`), espelhando `PermissionCodes` do backend. Se o backend adicionar códigos, atualizar essa constante. |
| Remoção de sobrescrita de permissão (restaurar herança) | Não existe. O `PUT` só grava concessão direta ou negação explícita. | A UI oferece apenas “Conceder” e “Negar”. |
| CRUD de organizações, unidades hospitalares e setores | Somente consulta. | Sem telas de criação/edição/status para esses recursos. |
| CRUD de níveis profissionais | Somente consulta. | Tela somente-leitura. |
| Métricas/contadores de dashboard | Nenhum endpoint agrega totais. | A Home **não** mostra números; apenas identidade, escopo e atalhos por permissão. |
| `GET` individual de vínculos de funcionário | Não existe (o `Location` das respostas `201` não é consultável isoladamente). | Vínculos são lidos a partir do detalhe do funcionário. |

## 2. Renovação de token enquanto a aplicação está carregada

O access token vive ~10 min (`Jwt:AccessTokenLifetimeMinutes = 10`). Não há
heartbeat: a renovação é **reativa e controlada** — o interceptor detecta o
`401`, dispara um único `refresh` compartilhado (single-flight), revalida
`/api/auth/me` e repete **no máximo uma vez** a consulta `GET` original. `POST`,
`PUT` e `PATCH` nunca são repetidos; os dados do formulário permanecem em memória
para o usuário reenviar. Isso atende às seções 9, 10 e 13 sem manter
artificialmente uma sessão que o servidor considere expirada
(`Session:InactivityTimeoutMinutes = 30`).

## 3. Sessão única

O backend revoga a sessão anterior a cada novo login e valida `jti` +
`session_version` a cada request. Quando isso resulta em `401` e o `refresh`
falha, o frontend encerra a sessão local, exibe mensagem amigável e redireciona
ao login (`SessionEndReason`). Não há tentativa de recriar a sessão.

## 4. CORS

A API **não registra CORS**. A integração é sempre de mesma origem:

- **Dev:** `ng serve` com `proxy.conf.json` encaminhando `/api` e `/health` para
  o Nginx do backend (`https://localhost:8443`, `secure:false` por causa do
  certificado local autoassinado).
- **Produção:** o Nginx do container do frontend serve o SPA e faz
  `proxy_pass` de `/api` e `/health` para o Nginx do backend (`API_UPSTREAM`).

Nenhuma configuração de CORS foi adicionada e `Access-Control-Allow-Origin: *`
não é usado em lugar nenhum.

## 5. CSP e headers

O Nginx do backend aplica hoje `Content-Security-Policy: default-src 'none'; …`,
adequado a uma **superfície de API pura** — essa política bloquearia um SPA.

O container do frontend traz sua própria CSP compatível com Angular compilado
(`docker/nginx.conf`): `script-src 'self'` (sem `unsafe-eval` — JIT é só de
desenvolvimento), `style-src 'self' 'unsafe-inline'` (necessário para estilos de
componente/atributos de estilo), `connect-src 'self'`, `frame-ancestors 'none'`,
`object-src 'none'`, `base-uri 'self'`. O build de produção desabilita
`inlineCritical` (`angular.json`) para não depender de `<style>` inline com hash.

**Não foi feita nenhuma alteração no Nginx do backend.** Para publicar frontend e
backend sob um único perímetro, a recomendação é colocar o Nginx do frontend (ou
um Nginx de borda equivalente) à frente, com a CSP acima, mantendo a API sem
exposição pública direta.

## 6. Docker / WSL 2

Os artefatos de containerização do frontend estão prontos:

- `Dockerfile` — build multi-stage; runtime `nginxinc/nginx-unprivileged`
  (uid 101, não-root), `read_only` viável (tudo gravável vai para `/tmp`),
  `cap_drop: ALL`, `no-new-privileges`, sem montar `/var/run/docker.sock`, sem
  container privilegiado, sem `curl | sh`.
- `docker/nginx.conf`, `docker/entrypoint.sh` — `envsubst` apenas de
  `${API_UPSTREAM}`.
- `docker-compose.yml` — composição **isolada** do frontend, publica só em
  `127.0.0.1:8082`, não altera a composição do backend.
- `.dockerignore` — exclui `.git`, `.env*`, specs, `docs`, `node_modules`, `dist`.

> **Validado no WSL 2 (`Ubuntu`, Docker Engine 29.8 / Compose v5.5.1):**
> `docker compose config --quiet` ✔, `docker compose build` ✔,
> `docker compose up -d` → container `healthy`. Verificado em runtime:
> `/`, SPA fallback, `/config.json`, `/healthz` OK; assets `.js/.css` com
> `Content-Type` correto e `Cache-Control: immutable`; headers de segurança +
> CSP em todas as respostas; `/api/*` faz proxy para `API_UPSTREAM` e devolve
> `504` de forma controlada quando o backend está fora do ar. Container roda
> como `uid=101(nginx)` (não-root), `ReadonlyRootfs=true`, `CapDrop=[ALL]`,
> `no-new-privileges:true`, publicado só em `127.0.0.1:8082`.
>
> ```powershell
> wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/lucas/source/repos/Sistema.Gestao.Empresarial.Frontend && docker compose config --quiet'
> wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/lucas/source/repos/Sistema.Gestao.Empresarial.Frontend && docker compose up -d --build'
> ```
>
> Para produção, fixe também os digests das imagens base (`node:22-alpine`,
> `nginxinc/nginx-unprivileged:1.27-alpine`) e rode um scan de vulnerabilidades.

## 7. Dependências vulneráveis avaliadas (seção 54)

`npm audit` reporta **2 vulnerabilidades moderadas**, ambas transitivas de
`karma` (`qs`, `body-parser`) — servidor HTTP local do runner de testes. **Não
entram no bundle de produção** (`npm audit --omit=dev` → 0). `npm audit fix` não
resolve sem `--force` (bump major do karma). Mantidas conscientemente; migrar
para um runner sem essa cadeia (ex.: `@analogjs/vitest-angular`) é a correção
definitiva quando o time decidir trocar o test runner.

## 8. Mudanças de backend que seriam úteis (mas NÃO foram feitas)

1. **Cookie HttpOnly + CSRF** para refresh/sessão → permitiria restaurar a
   sessão após reload sem reduzir segurança. Impacto: médio; exige endpoint de
   CSRF token e ajuste de `SameSite`.
2. **`GET /api/permissoes`** (catálogo de permissões ativo) → elimina a
   constante espelhada no frontend.
3. **`DELETE` de sobrescrita** em `/api/usuarios/{guid}/permissions/{code}` →
   permitiria “restaurar herança” em vez de só conceder/negar.
4. **Endpoints de leitura de um vínculo individual** de funcionário → hoje o
   frontend relê o funcionário inteiro após cada mutação de vínculo.

Todas essas são sugestões; o frontend permanece 100% compatível com o contrato
atual.
