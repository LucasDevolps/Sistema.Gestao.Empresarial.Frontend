/**
 * Permission catalogue.
 *
 * These codes mirror `PermissionCodes` in the backend
 * (Application/Authorization/PermissionContracts.cs). The backend is the single
 * source of truth: this list only drives menu/route/UI gating. Effective
 * permissions for the signed-in user always come from `GET /api/auth/me`
 * (spec sections 14, 15) — never from the JWT.
 *
 * Sectors and sector categories are full CRUD-without-delete resources
 * (`/api/setores*`, `/api/categorias-setor*`). Professional levels are a full
 * CRUD with logical deletion (`/api/niveis-profissionais*`); deleting requires
 * `NIVEL_PROFISSIONAL_EDITAR`. Hospital units (`/api/unidades-hospitalares*`)
 * are a full CRUD-without-delete guarded by their own `UNIDADE_HOSPITALAR_*`
 * codes — `FUNCIONARIO_VISUALIZAR` no longer authorizes them (backend PR #101).
 */
export const PERMISSION_CODES = [
  'CARGO_CRIAR',
  'CARGO_EDITAR',
  'CARGO_VISUALIZAR',
  'CATEGORIA_SETOR_CRIAR',
  'CATEGORIA_SETOR_EDITAR',
  'CATEGORIA_SETOR_VISUALIZAR',
  'FUNCIONARIO_CRIAR',
  'FUNCIONARIO_EDITAR',
  'FUNCIONARIO_VISUALIZAR',
  'JORNADA_TRABALHO_CRIAR',
  'JORNADA_TRABALHO_EDITAR',
  'JORNADA_TRABALHO_VISUALIZAR',
  'NIVEL_PROFISSIONAL_CRIAR',
  'NIVEL_PROFISSIONAL_EDITAR',
  'NIVEL_PROFISSIONAL_VISUALIZAR',
  'PROFISSAO_CRIAR',
  'PROFISSAO_EDITAR',
  'PROFISSAO_VISUALIZAR',
  'SETOR_CRIAR',
  'SETOR_EDITAR',
  'SETOR_VISUALIZAR',
  'UNIDADE_HOSPITALAR_CRIAR',
  'UNIDADE_HOSPITALAR_EDITAR',
  'UNIDADE_HOSPITALAR_VISUALIZAR',
  'USUARIO_GERENCIAR_PERMISSOES',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

/** Human-readable labels for the permission administration screen. */
export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  CARGO_CRIAR: 'Criar cargos',
  CARGO_EDITAR: 'Editar cargos',
  CARGO_VISUALIZAR: 'Visualizar cargos',
  CATEGORIA_SETOR_CRIAR: 'Criar categorias de setor',
  CATEGORIA_SETOR_EDITAR: 'Editar categorias de setor',
  CATEGORIA_SETOR_VISUALIZAR: 'Visualizar categorias de setor',
  FUNCIONARIO_CRIAR: 'Criar funcionários',
  FUNCIONARIO_EDITAR: 'Editar funcionários e vínculos',
  FUNCIONARIO_VISUALIZAR: 'Visualizar funcionários',
  JORNADA_TRABALHO_CRIAR: 'Criar jornadas de trabalho',
  JORNADA_TRABALHO_EDITAR: 'Editar e alterar situação de jornadas de trabalho',
  JORNADA_TRABALHO_VISUALIZAR: 'Visualizar jornadas de trabalho',
  NIVEL_PROFISSIONAL_CRIAR: 'Criar níveis profissionais',
  NIVEL_PROFISSIONAL_EDITAR: 'Editar e excluir níveis profissionais',
  NIVEL_PROFISSIONAL_VISUALIZAR: 'Visualizar níveis profissionais',
  PROFISSAO_CRIAR: 'Criar profissões',
  PROFISSAO_EDITAR: 'Editar profissões',
  PROFISSAO_VISUALIZAR: 'Visualizar profissões',
  SETOR_CRIAR: 'Criar setores',
  SETOR_EDITAR: 'Editar setores e unidades atendidas',
  SETOR_VISUALIZAR: 'Visualizar setores',
  UNIDADE_HOSPITALAR_CRIAR: 'Criar unidades hospitalares',
  UNIDADE_HOSPITALAR_EDITAR: 'Editar e alterar situação de unidades hospitalares',
  UNIDADE_HOSPITALAR_VISUALIZAR: 'Visualizar unidades hospitalares',
  USUARIO_GERENCIAR_PERMISSOES: 'Gerenciar permissões de usuários',
};

export function isKnownPermission(code: string): code is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(code);
}
