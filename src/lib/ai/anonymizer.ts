/**
 * PII Anonymizer for email content.
 *
 * Detects and replaces:
 * - PESEL numbers
 * - Phone numbers (Polish formats)
 * - Email addresses
 * - Bank account numbers (IBAN PL)
 * - Street addresses (ul., os., al.)
 * - Names (contextual: Pan/Pani, signatures)
 *
 * Maintains consistent mapping: same person = same identifier across the thread.
 */

export type PIIType = 'name' | 'phone' | 'email' | 'pesel' | 'bank_account' | 'address';

export interface PIIMatch {
  original: string;
  anonymized: string;
  type: PIIType;
  context: string;
}

export interface AnonymizationResult {
  anonymizedText: string;
  matches: PIIMatch[];
}

// --- Regex patterns ---

const PESEL_RE = /\b\d{2}[01]\d[0-3]\d{6}\b/g;

const PHONE_RE = /(?:\+48\s?)?(?:\d{3}[-\s]?\d{3}[-\s]?\d{3}|\d{2}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}|\d{2}[-\s]?\d{7})/g;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const IBAN_RE = /PL\s?\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/g;

// ul. Królewska 15A/3, os. Royal Residence, al. Niepodległości 10
const ADDRESS_RE = /(?:ul\.|os\.|al\.|ulica|osiedle|aleja)\s+[A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż\s]+\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?/gi;

// Pan/Pani + Name, podpisy "Imię Nazwisko", "Z poważaniem,"
const NAME_CONTEXT_RE = /(?:Pan(?:i|u|em|ią)?|Szanown[yaie]\s+Pan(?:i|ie|u)?)\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)?)/g;

const SIGNATURE_RE = /(?:^|\n)([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)\s*$/gm;

// License plate
const PLATE_RE = /\b[A-Z]{2,3}\s?\d{4,5}\b/g;

// --- Anonymizer class ---

export class Anonymizer {
  private nameCounter = 0;
  private phoneCounter = 0;
  private emailCounter = 0;
  private addressCounter = 0;
  private mapping = new Map<string, { anonymized: string; type: PIIType }>();

  /** Get or create an anonymized replacement for a PII value */
  private getAnonymized(original: string, type: PIIType): string {
    const key = `${type}:${original.toLowerCase().trim()}`;
    if (this.mapping.has(key)) {
      return this.mapping.get(key)!.anonymized;
    }

    let anonymized: string;
    switch (type) {
      case 'name':
        this.nameCounter++;
        anonymized = `Mieszkaniec #${this.nameCounter}`;
        break;
      case 'phone':
        this.phoneCounter++;
        anonymized = `[TEL-${String(this.phoneCounter).padStart(3, '0')}]`;
        break;
      case 'email':
        this.emailCounter++;
        anonymized = `osoba${this.emailCounter}@anonimowy.pl`;
        break;
      case 'pesel':
        anonymized = '[PESEL-UKRYTY]';
        break;
      case 'bank_account':
        anonymized = '[KONTO-UKRYTE]';
        break;
      case 'address':
        this.addressCounter++;
        anonymized = `[ADRES-${String(this.addressCounter).padStart(3, '0')}]`;
        break;
    }

    this.mapping.set(key, { anonymized, type });
    return anonymized;
  }

  /** Anonymize a single text block */
  anonymize(text: string, context = ''): AnonymizationResult {
    const matches: PIIMatch[] = [];
    let result = text;

    // Order matters: replace longer patterns first to avoid partial matches

    // 1. PESEL
    result = result.replace(PESEL_RE, (match) => {
      const anon = this.getAnonymized(match, 'pesel');
      matches.push({ original: match, anonymized: anon, type: 'pesel', context });
      return anon;
    });

    // 2. IBAN
    result = result.replace(IBAN_RE, (match) => {
      const anon = this.getAnonymized(match, 'bank_account');
      matches.push({ original: match, anonymized: anon, type: 'bank_account', context });
      return anon;
    });

    // 3. Addresses (before names, since addresses may contain name-like parts)
    result = result.replace(ADDRESS_RE, (match) => {
      const anon = this.getAnonymized(match, 'address');
      matches.push({ original: match, anonymized: anon, type: 'address', context });
      return anon;
    });

    // 4. License plates
    result = result.replace(PLATE_RE, (match) => {
      const anon = '[NR-REJ-UKRYTY]';
      matches.push({ original: match, anonymized: anon, type: 'address', context });
      return anon;
    });

    // 5. Emails (before phone, since emails may contain digits)
    result = result.replace(EMAIL_RE, (match) => {
      const anon = this.getAnonymized(match, 'email');
      matches.push({ original: match, anonymized: anon, type: 'email', context });
      return anon;
    });

    // 6. Phone numbers
    result = result.replace(PHONE_RE, (match) => {
      // Skip if it looks like a PESEL replacement already done
      if (match.includes('[')) return match;
      const anon = this.getAnonymized(match, 'phone');
      matches.push({ original: match, anonymized: anon, type: 'phone', context });
      return anon;
    });

    // 7. Names with context (Pan/Pani)
    result = result.replace(NAME_CONTEXT_RE, (match, name) => {
      const anon = this.getAnonymized(name, 'name');
      matches.push({ original: name, anonymized: anon, type: 'name', context });
      return match.replace(name, anon);
    });

    // 8. Signatures (Imię Nazwisko at end of line)
    result = result.replace(SIGNATURE_RE, (match, name) => {
      // Don't re-anonymize if already anonymized (Mieszkaniec #X) or generic words
      if (name.includes('#') || name.includes('[')) return match;
      // Skip common Polish closing phrases
      const skipWords = ['poważaniem', 'pozdrawiam', 'informację', 'dziękuję'];
      if (skipWords.some((w) => name.toLowerCase().includes(w))) return match;
      const anon = this.getAnonymized(name, 'name');
      matches.push({ original: name, anonymized: anon, type: 'name', context });
      return match.replace(name, anon);
    });

    return { anonymizedText: result, matches };
  }

  /** Anonymize an entire thread (array of email bodies) for consistent mapping */
  anonymizeThread(emails: { id: string; body_text: string | null }[]): {
    anonymizedEmails: Map<string, string>;
    allMatches: PIIMatch[];
  } {
    const anonymizedEmails = new Map<string, string>();
    const allMatches: PIIMatch[] = [];

    for (const email of emails) {
      if (!email.body_text) {
        anonymizedEmails.set(email.id, '');
        continue;
      }
      const { anonymizedText, matches } = this.anonymize(email.body_text, `email:${email.id}`);
      anonymizedEmails.set(email.id, anonymizedText);
      allMatches.push(...matches);
    }

    return { anonymizedEmails, allMatches };
  }

  /** Get the full mapping for storage in DB */
  getMapping(): Map<string, { anonymized: string; type: PIIType }> {
    return new Map(this.mapping);
  }

  /** Reset state */
  reset() {
    this.nameCounter = 0;
    this.phoneCounter = 0;
    this.emailCounter = 0;
    this.addressCounter = 0;
    this.mapping.clear();
  }
}
