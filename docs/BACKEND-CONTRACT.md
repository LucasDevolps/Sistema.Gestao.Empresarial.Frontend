# Matriz de rastreabilidade — Frontend ↔ Backend

Fonte da verdade: código local em
`C:\Users\lucas\source\repos\Sistema.Gestao.Empresarial.Backend`
(branch `main`, HEAD `03ad790…`, que já contém o merge da PR #14
`feature/frontend-support-endpoints`, commit `0a0505de…`).

Controllers confirmados no checkout: `Auth`, `Employees`, `HospitalUnits`,
`Organizations`, `Positions`, `ProfessionalLevels`, `Professions`, `Sectors`,
`SectorCategories`, `Users` — mais 3 health checks operacionais. O CRUD de
setores e o catálogo de categorias de setor foram adicionados na branch
`feature/gestao-setores-hospitalares`.

Nenhuma feature do frontend existe sem um endpoint real abaixo.

## Autenticação e identidade

| Feature (frontend) | Endpoint | Permissão | Request | Response |
|---|---|---|---|---|
| Login (`features/auth/login.component`) | `POST /api/auth/login` | anônimo + rate limit | `LoginRequest { email, password }` | `AuthenticationResponse` |
| Renovação silenciosa (`core/auth/auth.service` + interceptor) | `POST /api/auth/refresh` | anônimo + rate limit | `RefreshTokenRequest { sessionId, refreshToken }` | `AuthenticationResponse` (tokens rotacionados) |
| Logout (`shell` → `AuthService.logout`) | `POST /api/auth/logout` | sessão ativa | — | `204` |
| Carga de identidade/permissões (`AuthService.reloadIdentity`) | `GET /api/auth/me` | sessão ativa | — | `CurrentUserResponse` |

`AuthenticationResponse = { accessToken, refreshToken, tokenType, expiresIn, sessionId, userGuid }`.
`CurrentUserResponse = { userGuid, email, active, permissionVersion, employee|null, organization|null, hiringUnit|null, permissions[] }`.

## Funcionários e vínculos — `features/employees`

| Tela / ação | Endpoint | Permissão |
|---|---|---|
| Lista (`employees-list`) | `GET /api/funcionarios?search&active&actingUnitGuid&page&pageSize` | `FUNCIONARIO_VISUALIZAR` |
| Detalhe (`employee-detail`) | `GET /api/funcionarios/{guid}` | `FUNCIONARIO_VISUALIZAR` |
| Novo (`employee-form`) | `POST /api/funcionarios` | `FUNCIONARIO_CRIAR` |
| Editar dados (`employee-form`) | `PUT /api/funcionarios/{guid}` | `FUNCIONARIO_EDITAR` |
| Inativar/reativar (`employee-detail`) | `PATCH /api/funcionarios/{guid}/status` | `FUNCIONARIO_EDITAR` |
| Vincular unidade de atuação | `POST /api/funcionarios/{guid}/unidades-atuacao` | `FUNCIONARIO_EDITAR` |
| Encerrar atuação em unidade | `POST /api/funcionarios/{guid}/unidades-atuacao/{rel}/encerrar` | `FUNCIONARIO_EDITAR` |
| Vincular setor | `POST /api/funcionarios/{guid}/setores` | `FUNCIONARIO_EDITAR` |
| Encerrar atuação em setor | `POST /api/funcionarios/{guid}/setores/{rel}/encerrar` | `FUNCIONARIO_EDITAR` |

- `CreateEmployeeRequest`: `name, email, phone?, professionGuid, positionGuid, levelGuid, hiringUnitGuid, admissionDate, actingUnits?[], sectors?[]` — coleções com no máx. 50 itens distintos.
- `UpdateEmployeeRequest`: somente `name, email, phone?, professionGuid, positionGuid, levelGuid`. A UI de edição **não** oferece unidade de contratação, matrícula ou data de admissão.
- Não há `GET` individual dos caminhos de vínculo; os vínculos vêm no detalhe do funcionário.

## Organização, unidades e setores — `features/organization`

| Tela / uso | Endpoint | Permissão |
|---|---|---|
| Escopo atual (Home) | `GET /api/organizacoes/atual` | `FUNCIONARIO_VISUALIZAR` |
| Lista de unidades (`hospital-units-list`) | `GET /api/unidades-hospitalares?search&active&page&pageSize` | `FUNCIONARIO_VISUALIZAR` |
| Detalhe de unidade (`hospital-unit-detail`) | `GET /api/unidades-hospitalares/{guid}` | `FUNCIONARIO_VISUALIZAR` |
| Lista de setores (`sectors-list`) | `GET /api/setores?search&active&unitGuid&categoryGuid&page&pageSize` | `SETOR_VISUALIZAR` |
| Detalhe de setor (`sector-detail`) | `GET /api/setores/{guid}` | `SETOR_VISUALIZAR` |
| Novo setor (`sector-form`) | `POST /api/setores` | `SETOR_CRIAR` |
| Editar setor (`sector-form`) | `PUT /api/setores/{guid}` | `SETOR_EDITAR` |
| Inativar/reativar setor | `PATCH /api/setores/{guid}/status` | `SETOR_EDITAR` |
| Vincular unidade atendida | `POST /api/setores/{guid}/unidades-atendidas` | `SETOR_EDITAR` |
| Encerrar unidade atendida | `POST /api/setores/{guid}/unidades-atendidas/{rel}/encerrar` | `SETOR_EDITAR` |
| Lista de categorias (`sector-categories-list`) | `GET /api/categorias-setor?search&active&page&pageSize` | `CATEGORIA_SETOR_VISUALIZAR` |
| Detalhe/edição de categoria (`sector-category-form`) | `GET/PUT /api/categorias-setor/{guid}` | `CATEGORIA_SETOR_VISUALIZAR` / `CATEGORIA_SETOR_EDITAR` |
| Nova categoria | `POST /api/categorias-setor` | `CATEGORIA_SETOR_CRIAR` |
| Status de categoria | `PATCH /api/categorias-setor/{guid}/status` | `CATEGORIA_SETOR_EDITAR` |

Organizações e unidades hospitalares seguem **somente leitura**. Setores e
categorias de setor são **CRUD sem DELETE** — inativação, nunca exclusão física.

- `CreateSectorRequest`: `unitGuid, categoryGuid, name, sigla, description?, internalLocation?, extension?, email?, responsibleEmployeeGuid?, careRelated, allowsScheduleAllocation, allowsSharedActing, servedUnits?[]` (máx. 50 unidades atendidas distintas; só aceitas quando `allowsSharedActing = true` e diferentes da unidade principal).
- `UpdateSectorRequest`: os mesmos campos **exceto** `unitGuid` e `servedUnits` — a unidade principal é imutável e as unidades atendidas têm endpoints próprios com histórico.
- Sigla é normalizada em MAIÚSCULAS; unicidade de `name` **e** de `sigla` é por unidade principal (a mesma sigla pode existir em outra unidade). Conflito → `409` `DUPLICATE_BUSINESS_KEY` com `field` `name` ou `sigla`.
- Categoria de setor é um catálogo global (não multi-tenant), como profissões/cargos; não pode ser inativada enquanto houver setor ativo usando-a.

## Profissões, cargos e níveis — `features/catalogs`

| Tela / ação | Endpoint | Permissão |
|---|---|---|
| Lista profissões (`catalog-list` kind=profession) | `GET /api/profissoes` | `PROFISSAO_VISUALIZAR` |
| Detalhe/edição profissão (`catalog-form`) | `GET/PUT /api/profissoes/{guid}` | `PROFISSAO_VISUALIZAR` / `PROFISSAO_EDITAR` |
| Nova profissão | `POST /api/profissoes` | `PROFISSAO_CRIAR` |
| Status profissão | `PATCH /api/profissoes/{guid}/status` | `PROFISSAO_EDITAR` |
| Cargos (idem) | `GET/POST/PUT/PATCH /api/cargos…` | `CARGO_VISUALIZAR` / `CARGO_CRIAR` / `CARGO_EDITAR` |
| Níveis — lista (`professional-levels`) | `GET /api/niveis-profissionais?active` | `NIVEL_PROFISSIONAL_VISUALIZAR` |
| Nível — detalhe | `GET /api/niveis-profissionais/{guid}` | `NIVEL_PROFISSIONAL_VISUALIZAR` |

Profissões e cargos usam **inativação**, nunca DELETE. Níveis são somente consulta.
Não há botão “Excluir” em nenhuma dessas telas.

## Usuários e permissões — `features/users`

| Tela / ação | Endpoint | Permissão |
|---|---|---|
| Lista de usuários (`users-list`) | `GET /api/usuarios?search&active&page&pageSize` | `USUARIO_GERENCIAR_PERMISSOES` |
| Permissões do usuário (`user-permissions`) | `GET /api/usuarios/{userGuid}/permissions` | `USUARIO_GERENCIAR_PERMISSOES` |
| Conceder/negar permissão | `PUT /api/usuarios/{userGuid}/permissions/{code}` | `USUARIO_GERENCIAR_PERMISSOES` |

- O alvo é sempre escolhido pela listagem real; a UI não aceita `userGuid` digitado.
- `UserPermissionsResponse` usa o campo `version` (a identidade/listagem usam `permissionVersion`).
- Sem atualização otimista: após `204` a UI relê as permissões efetivas do alvo.
- Alterar as próprias permissões é bloqueado na UI e no backend.
- Conceder exige que o administrador também possua a permissão (botão “Conceder” desabilitado quando não possui).

## Catálogo de permissões (`core/models/permission.model.ts`)

`FUNCIONARIO_VISUALIZAR/CRIAR/EDITAR`, `PROFISSAO_VISUALIZAR/CRIAR/EDITAR`,
`CARGO_VISUALIZAR/CRIAR/EDITAR`, `NIVEL_PROFISSIONAL_VISUALIZAR`,
`SETOR_VISUALIZAR/CRIAR/EDITAR`, `CATEGORIA_SETOR_VISUALIZAR/CRIAR/EDITAR`,
`USUARIO_GERENCIAR_PERMISSOES`.

`SETOR_CRIAR` e as três `CATEGORIA_SETOR_*` foram adicionadas junto com o CRUD de
setores; `SETOR_EDITAR` agora é consumida (editar setor, status e unidades
atendidas).

O guard fica em **cada rota folha**, com a permissão exata do endpoint
(`/setores` → `SETOR_VISUALIZAR`, `/setores/novo` → `SETOR_CRIAR`,
`/setores/:guid/editar` → `SETOR_EDITAR`). O caminho pai `/setores` usa
`permissionGuardAny(SETOR_VISUALIZAR, SETOR_CRIAR, SETOR_EDITAR)` — apenas
"tem algum acesso a setor" — para não exigir `SETOR_VISUALIZAR` como
pré‑requisito de criar/editar (o backend não exige). Mesma estrutura para
`/categorias-setor`.

## Regras comuns aplicadas

- `page` 1..1.000.000, `pageSize` 1..100, padrões `page=1`/`pageSize=50` (a UI usa 20). Parâmetros vazios são omitidos (`core/http/http-params.ts`).
- Paginação/busca/filtros são server-side; não há ordenação configurável.
- `search` máx.: 200 (funcionários/unidades), 150 (profissões/cargos/setores), 120 (categorias de setor), 254 (usuários).
- Datas `DateOnly` trafegam como `YYYY-MM-DD` sem conversão de fuso (`<input type="date">` + `DateOnlyPipe`).
- Status HTTP: 400 validação, 401 sessão, 403 permissão/escopo, 404 ausente/oculto por tenant, 409 concorrência, 422 regra de domínio, 429 rate limit — mapeados em `core/http/api-error.ts`.
- `409` distingue dois casos pelo campo estável `code` do `ProblemDetails`: `DUPLICATE_BUSINESS_KEY` (chave de negócio duplicada — mensagem derivada do `field` `name`/`sigla`/`email`, ou do `detail` seguro do backend, nunca de detalhes de infraestrutura) versus qualquer outro `409` sem `code` (conflito de concorrência otimista, mensagem genérica de "recarregue e tente de novo"). `code`, `field` e `detail` ficam disponíveis em `ApiError`; `correlationId` é preservado.
- Sem retry genérico de 401/403/409/422/429; a única recuperação de 401 é o refresh controlado com no máximo uma repetição de `GET`.
