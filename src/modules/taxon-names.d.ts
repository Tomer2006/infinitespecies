export interface CommonTaxon { scientific: string; en: string; he: string; aliases: string[] }
export const commonTaxa: CommonTaxon[];
export function normalizeName(value: string): string;
export function nameDistance(a: string, b: string, max?: number): number;
export function findCommonTaxa(value: string): CommonTaxon[];
export function getCommonName(scientific: string, language?: 'en' | 'he'): string | null;
