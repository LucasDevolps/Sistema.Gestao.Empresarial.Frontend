import { buildParams } from './http-params';

describe('buildParams', () => {
  it('omits null, undefined and blank string values', () => {
    const params = buildParams({
      search: '  ',
      active: null,
      page: undefined,
      pageSize: 50,
    });
    expect(params.has('search')).toBe(false);
    expect(params.has('active')).toBe(false);
    expect(params.has('page')).toBe(false);
    expect(params.get('pageSize')).toBe('50');
  });

  it('keeps boolean false and numeric zero-ish values as strings', () => {
    const params = buildParams({ active: false, page: 1 });
    expect(params.get('active')).toBe('false');
    expect(params.get('page')).toBe('1');
  });

  it('trims nothing but still serialises non-blank strings verbatim', () => {
    const params = buildParams({ search: 'ana maria' });
    expect(params.get('search')).toBe('ana maria');
  });
});
