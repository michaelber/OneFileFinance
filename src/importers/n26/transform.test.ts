import { describe, it, expect } from 'vitest';
import { transformTransaction, mapTransactionType } from './transform';
import mockData from '../../__mocks__/mockN26Response.json';
import { N26RawTransaction } from './types';

describe('N26 Transform', () => {
  it('should map transaction types correctly', () => {
    expect(mapTransactionType('PT')).toBe('card_payment');
    expect(mapTransactionType('CT')).toBe('bank_transfer');
    expect(mapTransactionType('DT')).toBe('direct_debit');
    expect(mapTransactionType('AA')).toBe('atm');
    expect(mapTransactionType('ITP')).toBe('internal_transfer');
    expect(mapTransactionType('OTP')).toBe('internal_transfer');
    expect(mapTransactionType('XYZ')).toBe('unknown');
  });

  it('should transform raw transactions correctly', () => {
    const rawTx = mockData[0] as N26RawTransaction;
    const tx = transformTransaction(rawTx);

    expect(tx.id).toBe('tx-1');
    expect(tx.amount).toBe(-15.50);
    expect(tx.currency).toBe('EUR');
    expect(tx.merchantName).toBe('REWE Supermarkt');
    expect(tx.category).toBe('Groceries');
    expect(tx.type).toBe('card_payment');
    expect(tx.reference).toBe('Card payment');
    expect(tx.date).toBe(new Date(1698765432000).toISOString());
    expect(tx.balance).toBeNull();
    expect(tx.raw).toEqual(rawTx);
  });

  it('should prefer merchantName over partnerName', () => {
    const rawTx: N26RawTransaction = {
      id: 'test',
      amount: -10,
      currencyCode: 'EUR',
      visibleTS: 1000,
      type: 'PT',
      merchantName: 'Merchant',
      partnerName: 'Partner'
    };
    const tx = transformTransaction(rawTx);
    expect(tx.merchantName).toBe('Merchant');
  });

  it('should fallback to partnerName if merchantName is missing', () => {
    const rawTx: N26RawTransaction = {
      id: 'test',
      amount: -10,
      currencyCode: 'EUR',
      visibleTS: 1000,
      type: 'PT',
      partnerName: 'Partner'
    };
    const tx = transformTransaction(rawTx);
    expect(tx.merchantName).toBe('Partner');
  });

  it('should set merchantName to null if both are missing', () => {
    const rawTx: N26RawTransaction = {
      id: 'test',
      amount: -10,
      currencyCode: 'EUR',
      visibleTS: 1000,
      type: 'PT'
    };
    const tx = transformTransaction(rawTx);
    expect(tx.merchantName).toBeNull();
  });
});
