# Matriz de rastreabilidade — Frontend ↔ Backend

Fonte da verdade: código local em
`C:\Users\lucas\source\repos\Sistema.Gestao.Empresarial.Backend`
(branch `main`, HEAD `03ad790…`, que já contém o merge da PR #14
`feature/frontend-support-endpoints`, commit `0a0505de…`).

Controllers confirmados no checkout: `Auth`, `Employees`, `HospitalUnits`,
`Organizations`, `Positions`, `ProfessionalLevels`, `Professions`, `Sectors`,
`Users` — 33 endpoints de negócio + 3 health checks operacionais.

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
| Lista de setores (`sectors-list`) | `GET /api/setores?search&active&unitGuid&page&pageSize` | `SETOR_VISUALIZAR` |
| Detalhe de setor (`sector-detail`) | `GET /api/setores/{guid}` | `SETOR_VISUALIZAR` |

**Somente leitura.** Não há endpoint de criação/edição/status — e portanto nenhuma
tela de mutação — para organizações, unidades ou setores.

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
`SETOR_VISUALIZAR`, `SETOR_EDITAR`, `USUARIO_GERENCIAR_PERMISSOES`.

`SETOR_EDITAR` existe no enum do backend mas nenhum endpoint o consome — nenhuma
tela o utiliza (permanece apenas administrável na tela de permissões).

## Regras comuns aplicadas

- `page` 1..1.000.000, `pageSize` 1..100, padrões `page=1`/`pageSize=50` (a UI usa 20). Parâmetros vazios são omitidos (`core/http/http-params.ts`).
- Paginação/busca/filtros são server-side; não há ordenação configurável.
- `search` máx.: 200 (funcionários/unidades), 150 (profissões/cargos/setores), 254 (usuários).
- Datas `DateOnly` trafegam como `YYYY-MM-DD` sem conversão de fuso (`<input type="date">` + `DateOnlyPipe`).
- Status HTTP: 400 validação, 401 sessão, 403 permissão/escopo, 404 ausente/oculto por tenant, 409 concorrência, 422 regra de domínio, 429 rate limit — mapeados em `core/http/api-error.ts`.
- Sem retry genérico de 401/403/409/422/429; a única recuperação de 401 é o refresh controlado com no máximo uma repetição de `GET`.
