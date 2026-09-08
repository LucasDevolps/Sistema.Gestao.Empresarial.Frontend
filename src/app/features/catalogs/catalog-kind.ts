import { PermissionCode } from '../../core/models/permission.model';

export type CatalogKind = 'profession' | 'position';

export interface CatalogKindConfig {
  readonly kind: CatalogKind;
  readonly titlePlural: string;
  readonly titleSingular: string;
  readonly listPath: string;
  readonly view: PermissionCode;
  readonly create: PermissionCode;
  readonly edit: PermissionCode;
  /** Backend `search` max length for this catalogue (spec "Regras comuns"). */
  readonly searchMaxLength: number;
}

export const CATALOG_KINDS: Record<CatalogKind, CatalogKindConfig> = {
  profession: {
    kind: 'profession',
    titlePlural: 'Profissões',
    titleSingular: 'Profissão',
    listPath: '/profissoes',
    view: 'PROFISSAO_VISUALIZAR',
    create: 'PROFISSAO_CRIAR',
    edit: 'PROFISSAO_EDITAR',
    searchMaxLength: 150,
  },
  position: {
    kind: 'position',
    titlePlural: 'Cargos',
    titleSingular: 'Cargo',
    listPath: '/cargos',
    view: 'CARGO_VISUALIZAR',
    create: 'CARGO_CRIAR',
    edit: 'CARGO_EDITAR',
    searchMaxLength: 150,
  },
};
