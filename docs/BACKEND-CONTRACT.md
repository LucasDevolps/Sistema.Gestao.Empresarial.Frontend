# Matriz de rastreabilidade — Frontend ↔ Backend

Fonte da verdade: código local em
`C:\Users\lucas\source\repos\Sistema.Gestao.Empresarial.Backend`
(branch `main`, HEAD `c49afcbdcb5d5665b5905a2a61fbfb3b04db92bf`, que já contém o
merge da PR #71 `feature/gestao-setores-hospitalares` — CRUD de setores e
catálogo de categorias de setor — sobre a base da PR #14
`feature/frontend-support-endpoints`).

Controllers confirmados no checkout: `Auth`, `Employees`, `HospitalUnits`,
`Organizations`, `Positions`, `ProfessionalLevels`, `Professions`, `Sectors`,
`SectorCategories`, `Users` — mais 3 health checks operacionais.

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

> A coluna **Permissão** é a autorização **real de cada endpoint** no backend
> (`[RequirePermission(...)]`). Ela **não** muda: `POST /api/setores` exige
> `SETOR_CRIAR` e só. As permissões extras que uma **tela composta** precisa para
> funcionar (carregar catálogos etc.) estão na seção
> [Guards de rota e capacidade de tela](#guards-de-rota-e-capacidade-de-tela) e
> pertencem ao frontend, não ao endpoint.

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

## Guards de rota e capacidade de tela

**Permissão individual do endpoint** — o que o backend exige em cada rota HTTP
(`[RequirePermission]`). É a barreira de segurança e está na coluna *Permissão*
das tabelas acima. Nunca é ampliada pelo frontend.

**Capacidade completa da tela** — a união de **todas** as permissões que uma tela
(ou uma funcionalidade dentro dela) precisa para ser utilizável de ponta a ponta,
incluindo os `GET` de catálogo que populam selects. É maior ou igual à permissão
do endpoint de escrita e existe só para **evitar dead-ends de UX**: não abrir uma
tela que não consegue carregar seus dados obrigatórios, e esconder botões que
levariam a uma operação impossível de concluir.

Definição central e tipada em `core/auth/screen-permissions.ts`
(`SECTOR_SCREENS`, `SECTOR_CATEGORY_SCREENS`), consumida por rotas, menu, botões
de entrada e testes:

| Tela / ação (frontend) | Capacidade exigida | Endpoints que a tela consome |
|---|---|---|
| Visualizar setor (lista, detalhe) | `SETOR_VISUALIZAR` | `GET /api/setores`, `GET /api/setores/{guid}` |
| Criar setor (`/setores/novo`) | `SETOR_CRIAR` + `FUNCIONARIO_VISUALIZAR` + `CATEGORIA_SETOR_VISUALIZAR` | `POST /api/setores` + `GET /api/unidades-hospitalares` + `GET /api/categorias-setor` |
| Editar setor (`/setores/:guid/editar`) | `SETOR_VISUALIZAR` + `SETOR_EDITAR` + `CATEGORIA_SETOR_VISUALIZAR` | `GET /api/setores/{guid}` + `PUT /api/setores/{guid}` + `GET /api/categorias-setor` |
| Adicionar unidade atendida (form no detalhe) | `SETOR_VISUALIZAR` + `SETOR_EDITAR` + `FUNCIONARIO_VISUALIZAR` | `GET /api/setores/{guid}` + `GET /api/unidades-hospitalares` + `POST /api/setores/{guid}/unidades-atendidas` |
| Encerrar unidade atendida (ação no detalhe) | `SETOR_VISUALIZAR` + `SETOR_EDITAR` | `GET /api/setores/{guid}` (o vínculo já veio aqui) + `POST /api/setores/{guid}/unidades-atendidas/{rel}/encerrar` |
| Visualizar categorias (lista) | `CATEGORIA_SETOR_VISUALIZAR` | `GET /api/categorias-setor` |
| Criar categoria (`/categorias-setor/nova`) | `CATEGORIA_SETOR_CRIAR` | `POST /api/categorias-setor` (sem `GET` obrigatório) |
| Editar categoria (`/categorias-setor/:guid/editar`) | `CATEGORIA_SETOR_VISUALIZAR` + `CATEGORIA_SETOR_EDITAR` | `GET /api/categorias-setor/{guid}` + `PUT /api/categorias-setor/{guid}` |

Notas:

- **Editar setor não exige `FUNCIONARIO_VISUALIZAR`**: a lista de funcionários só
  serve para (opcionalmente) trocar o responsável; sem ela o formulário opera e
  exibe um aviso.
- **Encerrar unidade atendida não exige `FUNCIONARIO_VISUALIZAR`** só por dividir
  o mesmo bloco visual do "adicionar". O vínculo a encerrar já chegou em
  `GET /api/setores/{guid}` e a ação não consulta o catálogo de unidades. O form
  de "adicionar" é escondido independentemente, via `SECTOR_SCREENS.addServedUnit`.
- **Criar categoria não exige leitura**: `POST /api/categorias-setor` não depende
  de nenhum `GET` para renderizar o formulário.

Guards: cada rota folha usa `permissionGuard(...capacidade)` (exige **todas**).
O caminho pai `/setores` (e `/categorias-setor`) usa `permissionGuardAny(...)` —
"tem alguma capacidade na área" — só para não carregar o chunk de quem não tem
acesso nenhum; ele não mascara as dependências, pois a folha revalida o conjunto
completo. O menu aponta para a lista de cada área e é gated pela capacidade
`view`.

## Fonte de verdade da autorização

- **Backend = autoridade de segurança.** Todo endpoint é protegido por
  `[RequirePermission]`; qualquer requisição sem a permissão real recebe `403`,
  independentemente do que o frontend permitiu clicar.
- **Frontend = navegação e UX.** Guards, menu e botões usam as permissões
  **efetivas** retornadas por `GET /api/auth/me` (via `AuthStore`, nunca claims
  do JWT), em modo deny-by-default. As *capacidades de tela* servem só para
  impedir dead-ends e ocultar operações que o usuário não conseguiria concluir —
  **não** substituem nem relaxam a autorização do backend.

## Regras comuns aplicadas

- `page` 1..1.000.000, `pageSize` 1..100, padrões `page=1`/`pageSize=50` (a UI usa 20). Parâmetros vazios são omitidos (`core/http/http-params.ts`).
- Paginação/busca/filtros são server-side; não há ordenação configurável.
- `search` máx.: 200 (funcionários/unidades), 150 (profissões/cargos/setores), 120 (categorias de setor), 254 (usuários).
- Datas `DateOnly` trafegam como `YYYY-MM-DD` sem conversão de fuso (`<input type="date">` + `DateOnlyPipe`).
- Status HTTP: 400 validação, 401 sessão, 403 permissão/escopo, 404 ausente/oculto por tenant, 409 concorrência, 422 regra de domínio, 429 rate limit — mapeados em `core/http/api-error.ts`.
- `409` distingue dois casos pelo campo estável `code` do `ProblemDetails`: `DUPLICATE_BUSINESS_KEY` (chave de negócio duplicada — mensagem derivada do `field` `name`/`sigla`/`email`, ou do `detail` seguro do backend, nunca de detalhes de infraestrutura) versus qualquer outro `409` sem `code` (conflito de concorrência otimista, mensagem genérica de "recarregue e tente de novo"). `code`, `field` e `detail` ficam disponíveis em `ApiError`; `correlationId` é preservado.
- Sem retry genérico de 401/403/409/422/429; a única recuperação de 401 é o refresh controlado com no máximo uma repetição de `GET`.
