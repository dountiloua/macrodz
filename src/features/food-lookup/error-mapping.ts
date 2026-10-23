import type { LookupError } from './types';

export type ClassifiedErrorType =
  'NOT_FOUND' | 'NO_INTERNET' | 'TIMEOUT' | 'INVALID_DATA' | 'UNKNOWN';

export type ScanErrorMessageKey =
  | 'scan.errors.notFound'
  | 'scan.errors.noInternet'
  | 'scan.errors.timeout'
  | 'scan.errors.invalidData'
  | 'scan.errors.serverError'
  | 'scan.errors.unknown';

export type ErrorClassification = {
  type: ClassifiedErrorType;
  messageKey: ScanErrorMessageKey;
  isRetryable: boolean;
};

export function classifyLookupError(error: LookupError): ErrorClassification {
  switch (error.code) {
    case 'NOT_FOUND':
      return {
        type: 'NOT_FOUND',
        messageKey: 'scan.errors.notFound',
        isRetryable: false,
      };
    case 'NETWORK_ERROR':
      return {
        type: 'NO_INTERNET',
        messageKey: 'scan.errors.noInternet',
        isRetryable: true,
      };
    case 'TIMEOUT':
      return {
        type: 'TIMEOUT',
        messageKey: 'scan.errors.timeout',
        isRetryable: true,
      };
    case 'INCOMPLETE_DATA':
    case 'INVALID_DATA':
    case 'INVALID_BARCODE':
      return {
        type: 'INVALID_DATA',
        messageKey: 'scan.errors.invalidData',
        isRetryable: false,
      };
    case 'HTTP_ERROR':
      return {
        type: 'UNKNOWN',
        messageKey: error.status >= 500 ? 'scan.errors.serverError' : 'scan.errors.unknown',
        isRetryable: true,
      };
  }
}
