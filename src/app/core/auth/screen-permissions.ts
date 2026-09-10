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
 * Backend authority (`main` @ c49afcbdcb5d5665b5905a2a61fbfb3b04db92bf) — the
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
 * | `GET  /api/unidades-hospitalares`                    | `FUNCIONARIO_VISUALIZAR`    |
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
   * (`GET /api/unidades-hospitalares` → `FUNCIONARIO_VISUALIZAR`,
   * `GET /api/categorias-setor` → `CATEGORIA_SETOR_VISUALIZAR`).
   */
  create: ['SETOR_CRIAR', 'FUNCIONARIO_VISUALIZAR', 'CATEGORIA_SETOR_VISUALIZAR'],
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
   * `GET /api/unidades-hospitalares` → `FUNCIONARIO_VISUALIZAR`, so without that
   * read the form is a dead end. "Encerrar" is intentionally NOT here: the link
   * to end already arrived in `GET /api/setores/{guid}`, so it only needs
   * `SETOR_EDITAR` (see {@link SECTOR_SCREENS.view} for the read).
   */
  addServedUnit: ['SETOR_VISUALIZAR', 'SETOR_EDITAR', 'FUNCIONARIO_VISUALIZAR'],
} as const satisfies Record<string, readonly PermissionCode[]>;

export const SECTOR_CATEGORY_SCREENS = {
  /** List — a single read endpoint. */
  view: ['CATEGORIA_SETOR_VISUALIZAR'],
  /** New category — no read dependency, so only the write permission. */
  create: ['CATEGORIA_SETOR_CRIAR'],
  /** Edit category — read current state + write. */
  edit: ['CATEGORIA_SETOR_VISUALIZAR', 'CATEGORIA_SETOR_EDITAR'],
} as const satisfies Record<string, readonly PermissionCode[]>;
