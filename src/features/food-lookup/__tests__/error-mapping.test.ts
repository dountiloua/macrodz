import { describe, expect, it } from '@jest/globals';

import { classifyLookupError } from '../error-mapping';

describe('classifyLookupError', () => {
  it('classifies NOT_FOUND error as not found and non-retryable', () => {
    const result = classifyLookupError({ code: 'NOT_FOUND' });
    expect(result).toEqual({
      type: 'NOT_FOUND',
      messageKey: 'scan.errors.notFound',
      isRetryable: false,
    });
  });

  it('classifies NETWORK_ERROR as no internet and retryable', () => {
    const result = classifyLookupError({ code: 'NETWORK_ERROR' });
    expect(result).toEqual({
      type: 'NO_INTERNET',
      messageKey: 'scan.errors.noInternet',
      isRetryable: true,
    });
  });

  it('classifies TIMEOUT as timeout and retryable', () => {
    const result = classifyLookupError({ code: 'TIMEOUT' });
    expect(result).toEqual({
      type: 'TIMEOUT',
      messageKey: 'scan.errors.timeout',
      isRetryable: true,
    });
  });

  it('classifies INVALID_DATA, INCOMPLETE_DATA and INVALID_BARCODE as invalid data and non-retryable', () => {
    expect(classifyLookupError({ code: 'INVALID_DATA' })).toEqual({
      type: 'INVALID_DATA',
      messageKey: 'scan.errors.invalidData',
      isRetryable: false,
    });

    expect(classifyLookupError({ code: 'INCOMPLETE_DATA' })).toEqual({
      type: 'INVALID_DATA',
      messageKey: 'scan.errors.invalidData',
      isRetryable: false,
    });

    expect(classifyLookupError({ code: 'INVALID_BARCODE' })).toEqual({
      type: 'INVALID_DATA',
      messageKey: 'scan.errors.invalidData',
      isRetryable: false,
    });
  });

  it('classifies HTTP 5xx errors as server error and retryable', () => {
    const result = classifyLookupError({ code: 'HTTP_ERROR', status: 502 });
    expect(result).toEqual({
      type: 'UNKNOWN',
      messageKey: 'scan.errors.serverError',
      isRetryable: true,
    });
  });

  it('classifies other HTTP errors as unknown and retryable', () => {
    const result = classifyLookupError({ code: 'HTTP_ERROR', status: 418 });
    expect(result).toEqual({
      type: 'UNKNOWN',
      messageKey: 'scan.errors.unknown',
      isRetryable: true,
    });
  });
});
