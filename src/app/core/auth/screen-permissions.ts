import { PermissionCode } from '../models/permission.model';

/**
 * Permission *capabilities per screen*.
 *
 * A composed screen is only usable when the caller can reach **every** endpoint
 * it depends on — not just the write endpoint it targets. The "new sector" and
 * "edit sector" screens must load catalogs (hospital units, sector categories)
 * before the form works; entering them without those read permissions leaves a
 * dead form. Route guards, entry buttons/links, the sidebar menu and the tests
 * all read these constants, so the required set can never drift between them.
 *
 * Backend authority (`main` @ 0214274, merge of backend PR #101) — the
 * permission of each *individual* endpoint:
 * | Endpoint                                              | Permission                  |
 * |------------------------------------------------------|-----------------------------|
 * | `GET  /api/setores`                                  | `SETOR_VISUALIZAR`          |
 * | `GET  /api/setores/{guid}`                           | `SETOR_VISUALIZAR`          |
 * | `POST /api/setores`                                  | `SETOR_CRIAR`              |
 * | `PUT  /api/setores/{guid}`                           | `SETOR_EDITAR`             |
 * | `PATCH /api/setores/{guid}/status`                   | `SETOR_EDITAR`             |
 * | `POST /api/setores/{guid}/unidades-atendidas`        | `SETOR_EDITAR`             |
 * | `POST /api/setores/{guid}/unidades-atendidas/{r}/encerrar` | `SETOR_EDITAR`      |
 * | `GET  /api/unidades-hospitalares`                    | `UNIDADE_HOSPITALAR_VISUALIZAR` |
 * | `GET  /api/categorias-setor`                         | `CATEGORIA_SETOR_VISUALIZAR`|
 * | `GET  /api/categorias-setor/{g}`                     | `CATEGORIA_SETOR_VISUALIZAR`|
 * | `PUT  /api/categorias-setor/{g}`                     | `CATEGORIA_SETOR_EDITAR`   |
 *
 * The constants below are the *screen capability* — the union of every endpoint
 * a screen (or an in-screen feature) must reach to be usable. It is deliberately
 * a superset of any single endpoint's permission and never changes what the
 * backend enforces per endpoint.
 *
 * These are UX gates only. `/api/auth/me` remains the source of the effective
 * permission set (never the JWT) and the backend stays the definitive barrier.
 */
export const SECTOR_SCREENS = {
  /** List and detail — a single read endpoint. */
  view: ['SETOR_VISUALIZAR'],
  /**
   * New sector — the write endpoint plus the two catalogs the form must load
   * (`GET /api/unidades-hospitalares` → `UNIDADE_HOSPITALAR_VISUALIZAR`,
   * `GET /api/categorias-setor` → `CATEGORIA_SETOR_VISUALIZAR`). The staff list
   * (`FUNCIONARIO_VISUALIZAR`) only feeds the optional responsible, so it is not
   * required.
   */
  create: ['SETOR_CRIAR', 'UNIDADE_HOSPITALAR_VISUALIZAR', 'CATEGORIA_SETOR_VISUALIZAR'],
  /**
   * Edit sector — read current state + write + the category catalog. The staff
   * list is optional (only used to change the responsible), so
   * `FUNCIONARIO_VISUALIZAR` is deliberately **not** required here.
   */
  edit: ['SETOR_VISUALIZAR', 'SETOR_EDITAR', 'CATEGORIA_SETOR_VISUALIZAR'],
  /**
   * "Adicionar unidade atendida" on the sector detail screen — an in-screen
   * feature, not a route. It writes
   * (`POST /api/setores/{guid}/unidades-atendidas` → `SETOR_EDITAR`) but first
   * has to populate the unit `<select>` from
   * `GET /api/unidades-hospitalares` → `UNIDADE_HOSPITALAR_VISUALIZAR`, so without that
   * read the form is a dead end. "Encerrar" is intentionally NOT here: the link
   * to end already arrived in `GET /api/setores/{guid}`, so it only needs
   * `SETOR_EDITAR` (see {@link SECTOR_SCREENS.view} for the read).
   */
  addServedUnit: ['SETOR_VISUALIZAR', 'SETOR_EDITAR', 'UNIDADE_HOSPITALAR_VISUALIZAR'],
} as const satisfies Record<string, readonly PermissionCode[]>;

export const SECTOR_CATEGORY_SCREENS = {
  /** List — a single read endpoint. */
  view: ['CATEGORIA_SETOR_VISUALIZAR'],
  /** New category — no read dependency, so only the write permission. */
  create: ['CATEGORIA_SETOR_CRIAR'],
  /** Edit category — read current state + write. */
  edit: ['CATEGORIA_SETOR_VISUALIZAR', 'CATEGORIA_SETOR_EDITAR'],
} as const satisfies Record<string, readonly PermissionCode[]>;

/**
 * Professional levels (`/api/niveis-profissionais*`):
 * | Endpoint                                             | Permission                       |
 * |------------------------------------------------------|----------------------------------|
 * | `GET  /api/niveis-profissionais`                     | `NIVEL_PROFISSIONAL_VISUALIZAR`  |
 * | `GET  /api/niveis-profissionais/{guid}`              | `NIVEL_PROFISSIONAL_VISUALIZAR`  |
 * | `POST /api/niveis-profissionais`                     | `NIVEL_PROFISSIONAL_CRIAR`       |
 * | `PUT  /api/niveis-profissionais/{guid}`              | `NIVEL_PROFISSIONAL_EDITAR`      |
 * | `POST /api/niveis-profissionais/{guid}/excluir`      | `NIVEL_PROFISSIONAL_EDITAR`      |
 */
export const PROFESSIONAL_LEVEL_SCREENS = {
  /** List — a single read endpoint. */
  view: ['NIVEL_PROFISSIONAL_VISUALIZAR'],
  /** New level — no read dependency, so only the write permission. */
  create: ['NIVEL_PROFISSIONAL_CRIAR'],
  /** Edit level — read current state + write. */
  edit: ['NIVEL_PROFISSIONAL_VISUALIZAR', 'NIVEL_PROFISSIONAL_EDITAR'],
  /**
   * "Excluir" on the list screen — an in-screen action, not a route. The row only
   * exists after the list read, and the logical deletion is guarded by EDITAR.
   */
  delete: ['NIVEL_PROFISSIONAL_VISUALIZAR', 'NIVEL_PROFISSIONAL_EDITAR'],
} as const satisfies Record<string, readonly PermissionCode[]>;

/**
 * Hospital units (`/api/unidades-hospitalares*`, backend PR #101):
 * | Endpoint                                                  | Permission                      |
 * |-----------------------------------------------------------|---------------------------------|
 * | `GET   /api/unidades-hospitalares`                        | `UNIDADE_HOSPITALAR_VISUALIZAR` |
 * | `GET   /api/unidades-hospitalares/{guid}`                 | `UNIDADE_HOSPITALAR_VISUALIZAR` |
 * | `POST  /api/unidades-hospitalares`                        | `UNIDADE_HOSPITALAR_CRIAR`      |
 * | `PUT   /api/unidades-hospitalares/{guid}`                 | `UNIDADE_HOSPITALAR_EDITAR`     |
 * | `PATCH /api/unidades-hospitalares/{guid}/status`          | `UNIDADE_HOSPITALAR_EDITAR`     |
 * | `GET   /api/unidades-hospitalares/consulta-cnpj`          | `UNIDADE_HOSPITALAR_VISUALIZAR` |
 * | `GET   /api/unidades-hospitalares/consulta-cep`           | `UNIDADE_HOSPITALAR_VISUALIZAR` |
 * | `POST  /api/unidades-hospitalares/possiveis-duplicidades` | `UNIDADE_HOSPITALAR_VISUALIZAR` |
 */
export const HOSPITAL_UNIT_SCREENS = {
  /** List and detail — read endpoints only. */
  view: ['UNIDADE_HOSPITALAR_VISUALIZAR'],
  /**
   * New unit — only the write endpoint is mandatory: the form loads no catalog
   * (the organization comes from `/api/auth/me`). The CNPJ/CEP lookups and the
   * possible-duplicate check are optional helpers, gated in-screen by `lookup`.
   */
  create: ['UNIDADE_HOSPITALAR_CRIAR'],
  /** Edit unit — read the current state (the PUT replaces everything) + write. */
  edit: ['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR'],
  /**
   * "Inativar"/"Reativar" on the list and detail screens — an in-screen action,
   * not a route. The row only exists after a read, and the PATCH needs EDITAR.
   */
  status: ['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR'],
  /**
   * In-form helpers: "Consultar CNPJ", "Buscar CEP" and the possible-duplicate
   * check. Without it the form still saves; the helpers are just unavailable.
   */
  lookup: ['UNIDADE_HOSPITALAR_VISUALIZAR'],
} as const satisfies Record<string, readonly PermissionCode[]>;
