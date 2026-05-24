/**
 * Tests unitaires pour le formateur de lien WhatsApp
 */
import { describe, it, expect } from 'vitest';
import { formatWhatsAppUrl } from '../whatsapp';

describe('formatWhatsAppUrl', () => {
  it('formats a local number with country code', () => {
    const result = formatWhatsAppUrl('0102030405');
    expect(result).toBe('https://wa.me/225102030405');
  });

  it('formats a number already with country code', () => {
    const result = formatWhatsAppUrl('2250102030405');
    expect(result).toBe('https://wa.me/2250102030405');
  });

  it('strips non-digit characters', () => {
    const result = formatWhatsAppUrl('01 02 03 04 05');
    expect(result).toBe('https://wa.me/225102030405');
  });

  it('strips + prefix', () => {
    const result = formatWhatsAppUrl('+2250102030405');
    expect(result).toBe('https://wa.me/2250102030405');
  });

  it('encodes a message parameter', () => {
    const result = formatWhatsAppUrl('0102030405', 'Bonjour !');
    expect(result).toBe('https://wa.me/225102030405?text=Bonjour%20!');
  });

  it('encodes a message with special characters', () => {
    const result = formatWhatsAppUrl('0102030405', 'Hello\nWorld');
    expect(result).toBe('https://wa.me/225102030405?text=Hello%0AWorld');
  });

  it('returns null for empty number', () => {
    expect(formatWhatsAppUrl('')).toBeNull();
  });

  it('returns null for number with no digits', () => {
    expect(formatWhatsAppUrl('abc')).toBeNull();
  });

  it('handles number starting with +225 prefix', () => {
    const result = formatWhatsAppUrl('+2250102030405');
    expect(result).toBe('https://wa.me/2250102030405');
  });

  it('handles number with leading zeros correctly', () => {
    const result = formatWhatsAppUrl('000102030405');
    expect(result).toBe('https://wa.me/225102030405');
  });

  it('returns base URL without message when no message provided', () => {
    const result = formatWhatsAppUrl('0102030405');
    expect(result).toBe('https://wa.me/225102030405');
  });

  it('handles empty message string as no message', () => {
    // Empty string is falsy, so treated as no message → base URL without ?text=
    const result = formatWhatsAppUrl('0102030405', '');
    expect(result).toBe('https://wa.me/225102030405');
  });
});
