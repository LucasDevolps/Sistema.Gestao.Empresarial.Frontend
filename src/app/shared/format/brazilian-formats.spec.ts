import {
  BRAZILIAN_STATES,
  formatCep,
  formatCnaeCode,
  formatCnpj,
  formatPhone,
  isValidCep,
  isValidCnpj,
  isValidHttpUrl,
  isValidPhone,
  onlyDigits,
  stripCnpjMask,
} from './brazilian-formats';

describe('brazilian-formats', () => {
  describe('CNPJ', () => {
    it('formats progressively and accepts pasted values with or without punctuation', () => {
      expect(formatCnpj('11')).toBe('11');
      expect(formatCnpj('11222')).toBe('11.222');
      expect(formatCnpj('11222333')).toBe('11.222.333');
      expect(formatCnpj('112223330001')).toBe('11.222.333/0001');
      expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
      expect(formatCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
      expect(formatCnpj(' 11 222 333 0001 81 ')).toBe('11.222.333/0001-81');
    });

    it('leaves more than 14 digits unformatted so the validator can flag them', () => {
      expect(formatCnpj('112223330001810')).toBe('112223330001810');
    });

    it('validates the check digits exactly like the backend (CadastroBrasileiro.CnpjValido)', () => {
      expect(isValidCnpj('11.222.333/0001-81')).toBeTrue();
      expect(isValidCnpj('11222333000181')).toBeTrue();
      expect(isValidCnpj('11.444.777/0001-61')).toBeTrue();
      expect(isValidCnpj('11222333000182')).toBeFalse(); // wrong second digit
      expect(isValidCnpj('11222333000191')).toBeFalse(); // wrong first digit
      expect(isValidCnpj('00000000000000')).toBeFalse(); // repeated
      expect(isValidCnpj('1122233300018')).toBeFalse(); // 13 digits
      expect(isValidCnpj('11 222 333 0001 81')).toBeFalse(); // backend does not strip spaces
      expect(isValidCnpj('')).toBeFalse();
      expect(isValidCnpj(null)).toBeFalse();
    });

    it('strips only the characters the backend strips', () => {
      expect(stripCnpjMask(' 11.222.333/0001-81 ')).toBe('11222333000181');
    });
  });

  describe('CEP', () => {
    it('formats progressively', () => {
      expect(formatCep('01001')).toBe('01001');
      expect(formatCep('010010')).toBe('01001-0');
      expect(formatCep('01001000')).toBe('01001-000');
      expect(formatCep('01001-000')).toBe('01001-000');
      expect(formatCep('010010001')).toBe('010010001');
    });

    it('requires 8 digits after removing the hyphen', () => {
      expect(isValidCep('01001-000')).toBeTrue();
      expect(isValidCep('01001000')).toBeTrue();
      expect(isValidCep('0100100')).toBeFalse();
      expect(isValidCep('01001.000')).toBeFalse();
    });
  });

  describe('phones', () => {
    it('formats landlines and mobiles progressively', () => {
      expect(formatPhone('11')).toBe('(11');
      expect(formatPhone('1133')).toBe('(11) 33');
      expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
      expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
      expect(formatPhone('(11) 98765-4321')).toBe('(11) 98765-4321');
    });

    it('keeps international, 0800 and over-long numbers exactly as typed', () => {
      expect(formatPhone('+55 11 98765-4321')).toBe('+55 11 98765-4321');
      expect(formatPhone('0800 123 4567')).toBe('0800 123 4567');
      expect(formatPhone('119876543210')).toBe('119876543210');
      expect(formatPhone('')).toBe('');
    });

    it('mirrors CadastroBrasileiro.TelefoneValido (allowed chars, 8–15 digits, blank ok)', () => {
      expect(isValidPhone('')).toBeTrue();
      expect(isValidPhone('(11) 3333-4444')).toBeTrue();
      expect(isValidPhone('+55 (11) 98765-4321')).toBeTrue();
      expect(isValidPhone('1234567')).toBeFalse();
      expect(isValidPhone('1234567890123456')).toBeFalse();
      expect(isValidPhone('11 3333-4444 ramal 2')).toBeFalse();
    });
  });

  it('accepts only absolute http(s) URLs as site', () => {
    expect(isValidHttpUrl('')).toBeTrue();
    expect(isValidHttpUrl('https://hospital.test')).toBeTrue();
    expect(isValidHttpUrl('http://hospital.test/path')).toBeTrue();
    expect(isValidHttpUrl('hospital.test')).toBeFalse();
    expect(isValidHttpUrl('ftp://hospital.test')).toBeFalse();
    expect(isValidHttpUrl('javascript:alert(1)')).toBeFalse();
  });

  it('formats CNAE subclass codes', () => {
    expect(formatCnaeCode('8610101')).toBe('8610-1/01');
    expect(formatCnaeCode('8610-1/01')).toBe('8610-1/01');
    expect(formatCnaeCode(null)).toBe('');
  });

  it('lists the 27 UFs and extracts digits', () => {
    expect(BRAZILIAN_STATES.length).toBe(27);
    expect(onlyDigits('a1-2.3')).toBe('123');
  });
});
