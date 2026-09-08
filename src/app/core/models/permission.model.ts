/**
 * Permission catalogue.
 *
 * These codes mirror `PermissionCodes` in the backend
 * (Application/Authorization/PermissionContracts.cs). The backend is the single
 * source of truth: this list only drives menu/route/UI gating. Effective
 * permissions for the signed-in user always come from `GET /api/auth/me`
 * (spec sections 14, 15) — never from the JWT.
 *
 * `SETOR_EDITAR` exists in the backend enum but has NO endpoint, so no UI uses it.
 */
export const PERMISSION_CODES = [
  'FUNCIONARIO_VISUALIZAR',
  'FUNCIONARIO_CRIAR',
  'FUNCIONARIO_EDITAR',
  'PROFISSAO_VISUALIZAR',
  'PROFISSAO_CRIAR',
  'PROFISSAO_EDITAR',
  'CARGO_VISUALIZAR',
  'CARGO_CRIAR',
  'CARGO_EDITAR',
  'NIVEL_PROFISSIONAL_VISUALIZAR',
  'SETOR_VISUALIZAR',
  'SETOR_EDITAR',
  'USUARIO_GERENCIAR_PERMISSOES',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

/** Human-readable labels for the permission administration screen. */
export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  FUNCIONARIO_VISUALIZAR: 'Visualizar funcionários',
  FUNCIONARIO_CRIAR: 'Criar funcionários',
  FUNCIONARIO_EDITAR: 'Editar funcionários e vínculos',
  PROFISSAO_VISUALIZAR: 'Visualizar profissões',
  PROFISSAO_CRIAR: 'Criar profissões',
  PROFISSAO_EDITAR: 'Editar profissões',
  CARGO_VISUALIZAR: 'Visualizar cargos',
  CARGO_CRIAR: 'Criar cargos',
  CARGO_EDITAR: 'Editar cargos',
  NIVEL_PROFISSIONAL_VISUALIZAR: 'Visualizar níveis profissionais',
  SETOR_VISUALIZAR: 'Visualizar setores',
  SETOR_EDITAR: 'Editar setores',
  USUARIO_GERENCIAR_PERMISSOES: 'Gerenciar permissões de usuários',
};

export function isKnownPermission(code: string): code is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(code);
}
