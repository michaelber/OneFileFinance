import { N26RawTransaction, Transaction, TransactionType } from './types';

export function mapTransactionType(rawType: string): TransactionType {
  switch (rawType) {
    case 'PT':
      return 'card_payment';
    case 'CT':
      return 'bank_transfer';
    case 'DT':
      return 'direct_debit';
    case 'AA':
      return 'atm';
    case 'ITP':
    case 'OTP':
      return 'internal_transfer';
    default:
      return 'unknown';
  }
}

export function transformTransaction(raw: N26RawTransaction): Transaction {
  const date = new Date(raw.visibleTS).toISOString();
  const merchantName = raw.merchantName || raw.partnerName || null;
  
  return {
    id: raw.id,
    date,
    amount: raw.amount,
    currency: raw.currencyCode,
    merchantName,
    category: raw.category || null,
    type: mapTransactionType(raw.type),
    reference: raw.referenceText || null,
    balance: null,
    raw: raw as Record<string, unknown>,
  };
}
