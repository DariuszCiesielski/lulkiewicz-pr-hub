/**
 * Mock email data for seeding.
 * ~80 emails in 13 threads across 3 mailboxes.
 * Realistic Polish content with PII for anonymization testing.
 */

import { MOCK_MAILBOXES } from './seed-mailboxes';
import { daysAgo, buildReferences } from './seed-utils';

const ROYAL = MOCK_MAILBOXES[0].id;
const SADY = MOCK_MAILBOXES[1].id;
const ROBYG = MOCK_MAILBOXES[2].id;

export interface MockEmail {
  mailbox_id: string;
  internet_message_id: string;
  graph_id: string;
  conversation_id: string;
  subject: string;
  from_address: string;
  from_name: string;
  to_addresses: { address: string; name: string }[];
  cc_addresses: { address: string; name: string }[];
  sent_at: string;
  received_at: string;
  body_text: string;
  has_attachments: boolean;
  header_message_id: string;
  header_in_reply_to: string | null;
  header_references: string[];
  is_read: boolean;
}

// ============================================================
// ROYAL RESIDENCE — 6 watkow, ~40 emaili
// ============================================================

// --- Watek 1: Awaria windy (8 emaili, szybkie odpowiedzi <2h) ---
const R1_MSG1 = '<r1-001@royal-residence.pl>';
const R1_MSG2 = '<r1-002@gmail.com>';
const R1_MSG3 = '<r1-003@royal-residence.pl>';
const R1_MSG4 = '<r1-004@gmail.com>';
const R1_MSG5 = '<r1-005@royal-residence.pl>';
const R1_MSG6 = '<r1-006@gmail.com>';
const R1_MSG7 = '<r1-007@royal-residence.pl>';
const R1_MSG8 = '<r1-008@gmail.com>';

const royalThread1: MockEmail[] = [
  {
    mailbox_id: ROYAL, internet_message_id: R1_MSG1, graph_id: 'mock-graph-r1-001',
    conversation_id: 'conv-royal-1', subject: 'Awaria windy w klatce B',
    from_address: 'jan.kowalski.85@gmail.com', from_name: 'Jan Kowalski',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(14, 9), received_at: daysAgo(14, 9),
    body_text: `Dzien dobry,

Zgłaszam awarię windy w klatce B budynku przy ul. Królewskiej 15. Winda stoi na 3 pietrze z otwartymi drzwiami od wczorajszego wieczora.

Mieszkam w lokalu 15B/42. Proszę o pilną interwencję — moja mama, Halina Kowalska (lat 78), mieszka na 6 pietrze i nie może schodzić po schodach.

Kontakt do mnie: tel. 601-234-567

Z poważaniem,
Jan Kowalski
PESEL: 85120512345`,
    has_attachments: false,
    header_message_id: R1_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R1_MSG2, graph_id: 'mock-graph-r1-002',
    conversation_id: 'conv-royal-1', subject: 'Re: Awaria windy w klatce B',
    from_address: 'administracja@royal-residence.pl', from_name: 'Administracja Royal Residence',
    to_addresses: [{ address: 'jan.kowalski.85@gmail.com', name: 'Jan Kowalski' }],
    cc_addresses: [],
    sent_at: daysAgo(14, 8), received_at: daysAgo(14, 8),
    body_text: `Szanowny Panie Janie,

Dziękujemy za zgłoszenie. Technik firmy LiftService już został powiadomiony i powinien być na miejscu w ciągu 2 godzin.

Przepraszamy za utrudnienia. Jeśli Pana mama potrzebuje pomocy, prosimy o kontakt pod nr 22-100-2000.

Z poważaniem,
Marta Wiśniewska
Administracja Royal Residence
ul. Królewska 15, Warszawa
tel. +48 22 100 2000`,
    has_attachments: false,
    header_message_id: R1_MSG2, header_in_reply_to: R1_MSG1, header_references: buildReferences(R1_MSG1),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R1_MSG3, graph_id: 'mock-graph-r1-003',
    conversation_id: 'conv-royal-1', subject: 'Re: Awaria windy w klatce B',
    from_address: 'jan.kowalski.85@gmail.com', from_name: 'Jan Kowalski',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(14, 6), received_at: daysAgo(14, 6),
    body_text: `Dziękuję za szybką reakcję. Technik jest już na miejscu. Czy wiadomo ile potrwa naprawa?

Pozdrawiam,
Jan Kowalski`,
    has_attachments: false,
    header_message_id: R1_MSG3, header_in_reply_to: R1_MSG2, header_references: buildReferences(R1_MSG1, R1_MSG2),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R1_MSG4, graph_id: 'mock-graph-r1-004',
    conversation_id: 'conv-royal-1', subject: 'Re: Awaria windy w klatce B',
    from_address: 'administracja@royal-residence.pl', from_name: 'Marta Wiśniewska',
    to_addresses: [{ address: 'jan.kowalski.85@gmail.com', name: 'Jan Kowalski' }],
    cc_addresses: [],
    sent_at: daysAgo(14, 5), received_at: daysAgo(14, 5),
    body_text: `Panie Janie,

Technik zdiagnozował problem — uszkodzony czujnik drzwi na 3 piętrze. Część zamienna jest zamówiona i naprawa powinna być zakończona jutro do godz. 12:00.

Pozdrawiam,
Marta Wiśniewska`,
    has_attachments: false,
    header_message_id: R1_MSG4, header_in_reply_to: R1_MSG3, header_references: buildReferences(R1_MSG1, R1_MSG2, R1_MSG3),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R1_MSG5, graph_id: 'mock-graph-r1-005',
    conversation_id: 'conv-royal-1', subject: 'Re: Awaria windy w klatce B',
    from_address: 'jan.kowalski.85@gmail.com', from_name: 'Jan Kowalski',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(13, 14), received_at: daysAgo(13, 14),
    body_text: `Dzień dobry, jest już po 12:00 a winda nadal nie działa. Kiedy można spodziewać się naprawy?

Jan Kowalski`,
    has_attachments: false,
    header_message_id: R1_MSG5, header_in_reply_to: R1_MSG4, header_references: buildReferences(R1_MSG1, R1_MSG2, R1_MSG3, R1_MSG4),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R1_MSG6, graph_id: 'mock-graph-r1-006',
    conversation_id: 'conv-royal-1', subject: 'Re: Awaria windy w klatce B',
    from_address: 'administracja@royal-residence.pl', from_name: 'Marta Wiśniewska',
    to_addresses: [{ address: 'jan.kowalski.85@gmail.com', name: 'Jan Kowalski' }],
    cc_addresses: [],
    sent_at: daysAgo(13, 13), received_at: daysAgo(13, 13),
    body_text: `Panie Janie,

Przepraszam za opóźnienie. Część zamienna dotarła z opóźnieniem. Technik Andrzej Nowicki jest już na miejscu i winda powinna działać do godz. 15:00.

Pozdrawiam,
Marta Wiśniewska
tel. +48 22 100 2000`,
    has_attachments: false,
    header_message_id: R1_MSG6, header_in_reply_to: R1_MSG5, header_references: buildReferences(R1_MSG1, R1_MSG2, R1_MSG3, R1_MSG4, R1_MSG5),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R1_MSG7, graph_id: 'mock-graph-r1-007',
    conversation_id: 'conv-royal-1', subject: 'Re: Awaria windy w klatce B',
    from_address: 'jan.kowalski.85@gmail.com', from_name: 'Jan Kowalski',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(13, 8), received_at: daysAgo(13, 8),
    body_text: `Winda działa. Dziękuję za załatwienie sprawy. Proszę jednak o rozważenie regularnych przeglądów — to już trzecia awaria w tym roku.

Pozdrawiam,
Jan Kowalski`,
    has_attachments: false,
    header_message_id: R1_MSG7, header_in_reply_to: R1_MSG6, header_references: buildReferences(R1_MSG1, R1_MSG2, R1_MSG3, R1_MSG4, R1_MSG5, R1_MSG6),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R1_MSG8, graph_id: 'mock-graph-r1-008',
    conversation_id: 'conv-royal-1', subject: 'Re: Awaria windy w klatce B',
    from_address: 'administracja@royal-residence.pl', from_name: 'Marta Wiśniewska',
    to_addresses: [{ address: 'jan.kowalski.85@gmail.com', name: 'Jan Kowalski' }],
    cc_addresses: [],
    sent_at: daysAgo(13, 7), received_at: daysAgo(13, 7),
    body_text: `Panie Janie,

Cieszę się, że sprawa została rozwiązana. Ma Pan rację — zleciliśmy firmie LiftService przegląd wszystkich wind na osiedlu. Przegląd odbędzie się 15 marca.

Z poważaniem,
Marta Wiśniewska
Administracja Royal Residence`,
    has_attachments: false,
    header_message_id: R1_MSG8, header_in_reply_to: R1_MSG7, header_references: buildReferences(R1_MSG1, R1_MSG2, R1_MSG3, R1_MSG4, R1_MSG5, R1_MSG6, R1_MSG7),
    is_read: true,
  },
];

// --- Watek 2: Hałas z budowy (6 emaili, wolne odpowiedzi 3-5 dni) ---
const R2_MSG1 = '<r2-001@gmail.com>';
const R2_MSG2 = '<r2-002@royal-residence.pl>';
const R2_MSG3 = '<r2-003@gmail.com>';
const R2_MSG4 = '<r2-004@royal-residence.pl>';
const R2_MSG5 = '<r2-005@gmail.com>';
const R2_MSG6 = '<r2-006@royal-residence.pl>';

const royalThread2: MockEmail[] = [
  {
    mailbox_id: ROYAL, internet_message_id: R2_MSG1, graph_id: 'mock-graph-r2-001',
    conversation_id: 'conv-royal-2', subject: 'Reklamacja - hałas z budowy parkingu',
    from_address: 'anna.nowak.79@wp.pl', from_name: 'Anna Nowak',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(21), received_at: daysAgo(21),
    body_text: `Szanowni Państwo,

Od trzech tygodni trwają prace budowlane przy parkingu podziemnym. Hałas zaczyna się o 6:00 rano i trwa do 22:00, co jest niezgodne z regulaminem osiedla.

Mieszkam z dwójką małych dzieci w lokalu 15A/12 (ul. Królewska 15A) i nie jestem w stanie zapewnić im odpoczynku.

Proszę o natychmiastową interwencję i ograniczenie godzin pracy budowy do 8:00-18:00 zgodnie z regulaminem.

Anna Nowak
tel. 512-345-678
email: anna.nowak.79@wp.pl`,
    has_attachments: false,
    header_message_id: R2_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R2_MSG2, graph_id: 'mock-graph-r2-002',
    conversation_id: 'conv-royal-2', subject: 'Odp: Reklamacja - hałas z budowy parkingu',
    from_address: 'administracja@royal-residence.pl', from_name: 'Administracja Royal Residence',
    to_addresses: [{ address: 'anna.nowak.79@wp.pl', name: 'Anna Nowak' }],
    cc_addresses: [],
    sent_at: daysAgo(17), received_at: daysAgo(17),
    body_text: `Szanowna Pani Anno,

Dziękujemy za zgłoszenie. Przekazaliśmy Pani uwagi do kierownika budowy, Pana Tomasza Zielińskiego (firma BudPark Sp. z o.o.).

Postaramy się wyjaśnić sytuację i poinformujemy Panią o wynikach.

Z poważaniem,
Administracja Royal Residence`,
    has_attachments: false,
    header_message_id: R2_MSG2, header_in_reply_to: R2_MSG1, header_references: buildReferences(R2_MSG1),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R2_MSG3, graph_id: 'mock-graph-r2-003',
    conversation_id: 'conv-royal-2', subject: 'Re: Reklamacja - hałas z budowy parkingu',
    from_address: 'anna.nowak.79@wp.pl', from_name: 'Anna Nowak',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(14), received_at: daysAgo(14),
    body_text: `Dzień dobry,

Minął tydzień od mojego zgłoszenia, a sytuacja się nie zmieniła. Prace nadal trwają od 6 rano. Czekam na konkretne działania, nie na obietnice.

Anna Nowak`,
    has_attachments: false,
    header_message_id: R2_MSG3, header_in_reply_to: R2_MSG2, header_references: buildReferences(R2_MSG1, R2_MSG2),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R2_MSG4, graph_id: 'mock-graph-r2-004',
    conversation_id: 'conv-royal-2', subject: 'Re: Reklamacja - hałas z budowy parkingu',
    from_address: 'administracja@royal-residence.pl', from_name: 'Marta Wiśniewska',
    to_addresses: [{ address: 'anna.nowak.79@wp.pl', name: 'Anna Nowak' }],
    cc_addresses: [],
    sent_at: daysAgo(11), received_at: daysAgo(11),
    body_text: `Szanowna Pani Anno,

Przepraszam za opóźnioną odpowiedź. Spotkaliśmy się z kierownikiem budowy. Godziny pracy zostały zmienione na 7:30-19:00. Niestety nie udało się wynegocjować krótszych godzin ze względu na harmonogram inwestycji.

Pozdrawiam,
Marta Wiśniewska`,
    has_attachments: false,
    header_message_id: R2_MSG4, header_in_reply_to: R2_MSG3, header_references: buildReferences(R2_MSG1, R2_MSG2, R2_MSG3),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R2_MSG5, graph_id: 'mock-graph-r2-005',
    conversation_id: 'conv-royal-2', subject: 'Re: Reklamacja - hałas z budowy parkingu',
    from_address: 'anna.nowak.79@wp.pl', from_name: 'Anna Nowak',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(10), received_at: daysAgo(10),
    body_text: `To jest nieakceptowalne. 7:30 to nadal za wcześnie. Regulamin mówi o 8:00. Jeśli nie dostosujecie się do regulaminu, będę zmuszona zgłosić sprawę do Straży Miejskiej.

Anna Nowak`,
    has_attachments: false,
    header_message_id: R2_MSG5, header_in_reply_to: R2_MSG4, header_references: buildReferences(R2_MSG1, R2_MSG2, R2_MSG3, R2_MSG4),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R2_MSG6, graph_id: 'mock-graph-r2-006',
    conversation_id: 'conv-royal-2', subject: 'Re: Reklamacja - hałas z budowy parkingu',
    from_address: 'administracja@royal-residence.pl', from_name: 'Marta Wiśniewska',
    to_addresses: [{ address: 'anna.nowak.79@wp.pl', name: 'Anna Nowak' }],
    cc_addresses: [{ address: 'zarzad@royal-residence.pl', name: 'Zarząd Royal Residence' }],
    sent_at: daysAgo(7), received_at: daysAgo(7),
    body_text: `Szanowna Pani Anno,

Poinformowałam zarząd o sytuacji. Godziny pracy budowy zostały ostatecznie ustalone na 8:00-18:00, zgodnie z regulaminem. Zmiana obowiązuje od poniedziałku.

Przepraszamy za niedogodności i długi czas rozpatrywania reklamacji.

Z poważaniem,
Marta Wiśniewska
Administracja Royal Residence`,
    has_attachments: false,
    header_message_id: R2_MSG6, header_in_reply_to: R2_MSG5, header_references: buildReferences(R2_MSG1, R2_MSG2, R2_MSG3, R2_MSG4, R2_MSG5),
    is_read: true,
  },
];

// --- Watek 3: Rozliczenie ogrzewania (5 emaili, standardowy czas) ---
const R3_MSG1 = '<r3-001@onet.pl>';
const R3_MSG2 = '<r3-002@royal-residence.pl>';
const R3_MSG3 = '<r3-003@onet.pl>';
const R3_MSG4 = '<r3-004@royal-residence.pl>';
const R3_MSG5 = '<r3-005@onet.pl>';

const royalThread3: MockEmail[] = [
  {
    mailbox_id: ROYAL, internet_message_id: R3_MSG1, graph_id: 'mock-graph-r3-001',
    conversation_id: 'conv-royal-3', subject: 'Rozliczenie kosztów ogrzewania 2025',
    from_address: 'piotr.wisniewski@onet.pl', from_name: 'Piotr Wiśniewski',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(10), received_at: daysAgo(10),
    body_text: `Dzień dobry,

Proszę o przesłanie rozliczenia kosztów ogrzewania za sezon 2024/2025 dla lokalu 15C/8.

Dotychczasowa zaliczka wynosiła 450 zł/miesiąc. Czy jest możliwość wpłaty nadpłaty na konto wspólnoty?

Nr konta do zwrotu: PL61 1090 1014 0000 0712 1981 2874

Piotr Wiśniewski
ul. Królewska 15C/8
tel. 603-456-789`,
    has_attachments: false,
    header_message_id: R3_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R3_MSG2, graph_id: 'mock-graph-r3-002',
    conversation_id: 'conv-royal-3', subject: 'Re: Rozliczenie kosztów ogrzewania 2025',
    from_address: 'administracja@royal-residence.pl', from_name: 'Katarzyna Dąbrowska',
    to_addresses: [{ address: 'piotr.wisniewski@onet.pl', name: 'Piotr Wiśniewski' }],
    cc_addresses: [],
    sent_at: daysAgo(9), received_at: daysAgo(9),
    body_text: `Szanowny Panie Piotrze,

Rozliczenie ogrzewania zostanie przesłane do wszystkich mieszkańców do końca tego miesiąca. Wstępne obliczenia wskazują na nadpłatę w Pana lokalu w wysokości ok. 380 zł.

Nadpłata zostanie automatycznie zaliczona na poczet przyszłych zaliczek, chyba że Pan zażyczy sobie zwrotu na wskazane konto.

Z poważaniem,
Katarzyna Dąbrowska
Dział Rozliczeń`,
    has_attachments: false,
    header_message_id: R3_MSG2, header_in_reply_to: R3_MSG1, header_references: buildReferences(R3_MSG1),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R3_MSG3, graph_id: 'mock-graph-r3-003',
    conversation_id: 'conv-royal-3', subject: 'Re: Rozliczenie kosztów ogrzewania 2025',
    from_address: 'piotr.wisniewski@onet.pl', from_name: 'Piotr Wiśniewski',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(9, 2), received_at: daysAgo(9, 2),
    body_text: `Proszę o zwrot na podane konto bankowe. Dziękuję za informację.

Piotr Wiśniewski`,
    has_attachments: false,
    header_message_id: R3_MSG3, header_in_reply_to: R3_MSG2, header_references: buildReferences(R3_MSG1, R3_MSG2),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R3_MSG4, graph_id: 'mock-graph-r3-004',
    conversation_id: 'conv-royal-3', subject: 'Re: Rozliczenie kosztów ogrzewania 2025',
    from_address: 'administracja@royal-residence.pl', from_name: 'Katarzyna Dąbrowska',
    to_addresses: [{ address: 'piotr.wisniewski@onet.pl', name: 'Piotr Wiśniewski' }],
    cc_addresses: [],
    sent_at: daysAgo(8), received_at: daysAgo(8),
    body_text: `Przyjęto do realizacji. Zwrot nastąpi w ciągu 14 dni roboczych.

Pozdrawiam,
Katarzyna Dąbrowska`,
    has_attachments: false,
    header_message_id: R3_MSG4, header_in_reply_to: R3_MSG3, header_references: buildReferences(R3_MSG1, R3_MSG2, R3_MSG3),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R3_MSG5, graph_id: 'mock-graph-r3-005',
    conversation_id: 'conv-royal-3', subject: 'Re: Rozliczenie kosztów ogrzewania 2025',
    from_address: 'piotr.wisniewski@onet.pl', from_name: 'Piotr Wiśniewski',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(1), received_at: daysAgo(1),
    body_text: `Potwierdzam otrzymanie zwrotu. Dziękuję za sprawną obsługę.

Pozdrawiam,
Piotr Wiśniewski`,
    has_attachments: false,
    header_message_id: R3_MSG5, header_in_reply_to: R3_MSG4, header_references: buildReferences(R3_MSG1, R3_MSG2, R3_MSG3, R3_MSG4),
    is_read: true,
  },
];

// --- Watek 4: Remont klatki (4 emaile) ---
const R4_MSG1 = '<r4-001@royal-residence.pl>';
const R4_MSG2 = '<r4-002@gmail.com>';
const R4_MSG3 = '<r4-003@royal-residence.pl>';
const R4_MSG4 = '<r4-004@gmail.com>';

const royalThread4: MockEmail[] = [
  {
    mailbox_id: ROYAL, internet_message_id: R4_MSG1, graph_id: 'mock-graph-r4-001',
    conversation_id: 'conv-royal-4', subject: 'Remont klatki schodowej A - harmonogram',
    from_address: 'administracja@royal-residence.pl', from_name: 'Administracja Royal Residence',
    to_addresses: [{ address: 'mieszkancy.klatka.a@royal-residence.pl', name: 'Mieszkańcy klatki A' }],
    cc_addresses: [],
    sent_at: daysAgo(20), received_at: daysAgo(20),
    body_text: `Szanowni Mieszkańcy klatki A,

Informujemy, że w dniach 10-24 marca br. odbędzie się remont klatki schodowej obejmujący:
- malowanie ścian i sufitów
- wymianę oświetlenia na LED
- renowację poręczy

Prace wykonywać będzie firma MalBud Sp. z o.o. (kontakt: Krzysztof Maj, tel. 798-111-222).

Prosimy o wyrozumiałość. Klatka będzie dostępna przez cały czas remontu.

Z poważaniem,
Administracja Royal Residence`,
    has_attachments: true,
    header_message_id: R4_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R4_MSG2, graph_id: 'mock-graph-r4-002',
    conversation_id: 'conv-royal-4', subject: 'Re: Remont klatki schodowej A - harmonogram',
    from_address: 'barbara.lewandowska@gmail.com', from_name: 'Barbara Lewandowska',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(19), received_at: daysAgo(19),
    body_text: `Dzień dobry,

Czy farby użyte do malowania będą bezzapachowe? Mam alergię na silne zapachy chemiczne. Mieszkam w lokalu 15A/3.

Barbara Lewandowska
os. Royal Residence, ul. Królewska 15A/3`,
    has_attachments: false,
    header_message_id: R4_MSG2, header_in_reply_to: R4_MSG1, header_references: buildReferences(R4_MSG1),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R4_MSG3, graph_id: 'mock-graph-r4-003',
    conversation_id: 'conv-royal-4', subject: 'Re: Remont klatki schodowej A - harmonogram',
    from_address: 'administracja@royal-residence.pl', from_name: 'Marta Wiśniewska',
    to_addresses: [{ address: 'barbara.lewandowska@gmail.com', name: 'Barbara Lewandowska' }],
    cc_addresses: [],
    sent_at: daysAgo(18), received_at: daysAgo(18),
    body_text: `Szanowna Pani Barbaro,

Farby użyte do remontu będą lateksowe, niskoemisyjne. Niemniej prosimy o wietrzenie mieszkania w trakcie malowania piętra, na którym Pani mieszka (3 piętro — planowane na 15-16 marca).

Pozdrawiam,
Marta Wiśniewska`,
    has_attachments: false,
    header_message_id: R4_MSG3, header_in_reply_to: R4_MSG2, header_references: buildReferences(R4_MSG1, R4_MSG2),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R4_MSG4, graph_id: 'mock-graph-r4-004',
    conversation_id: 'conv-royal-4', subject: 'Re: Remont klatki schodowej A - harmonogram',
    from_address: 'barbara.lewandowska@gmail.com', from_name: 'Barbara Lewandowska',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(18, 2), received_at: daysAgo(18, 2),
    body_text: `Dziękuję za informację. Dostosujemy się.

Barbara Lewandowska`,
    has_attachments: false,
    header_message_id: R4_MSG4, header_in_reply_to: R4_MSG3, header_references: buildReferences(R4_MSG1, R4_MSG2, R4_MSG3),
    is_read: true,
  },
];

// --- Watek 5: Zalewanie garazu (7 emaili, eskalacja) ---
const R5_MSG1 = '<r5-001@gmail.com>';
const R5_MSG2 = '<r5-002@royal-residence.pl>';
const R5_MSG3 = '<r5-003@gmail.com>';
const R5_MSG4 = '<r5-004@gmail.com>';
const R5_MSG5 = '<r5-005@royal-residence.pl>';
const R5_MSG6 = '<r5-006@gmail.com>';
const R5_MSG7 = '<r5-007@royal-residence.pl>';

const royalThread5: MockEmail[] = [
  {
    mailbox_id: ROYAL, internet_message_id: R5_MSG1, graph_id: 'mock-graph-r5-001',
    conversation_id: 'conv-royal-5', subject: 'PILNE: Zalewanie garażu podziemnego',
    from_address: 'marek.kaczmarek@gmail.com', from_name: 'Marek Kaczmarek',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(30), received_at: daysAgo(30),
    body_text: `PILNE!

W garażu podziemnym (poziom -1, sektor C) jest woda na podłodze — ok. 5 cm. Mój samochód (Toyota Corolla, WE 12345) stoi w wodzie.

Proszę o natychmiastową interwencję!

Marek Kaczmarek
miejsce parkingowe C-42
tel. 505-678-901`,
    has_attachments: false,
    header_message_id: R5_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R5_MSG2, graph_id: 'mock-graph-r5-002',
    conversation_id: 'conv-royal-5', subject: 'Re: PILNE: Zalewanie garażu podziemnego',
    from_address: 'administracja@royal-residence.pl', from_name: 'Administracja Royal Residence',
    to_addresses: [{ address: 'marek.kaczmarek@gmail.com', name: 'Marek Kaczmarek' }],
    cc_addresses: [],
    sent_at: daysAgo(27), received_at: daysAgo(27),
    body_text: `Szanowny Panie Marku,

Jesteśmy świadomi problemu. Zleciliśmy przegląd instalacji odwadniającej. Poinformujemy o wynikach.

Pozdrawiam,
Administracja Royal Residence`,
    has_attachments: false,
    header_message_id: R5_MSG2, header_in_reply_to: R5_MSG1, header_references: buildReferences(R5_MSG1),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R5_MSG3, graph_id: 'mock-graph-r5-003',
    conversation_id: 'conv-royal-5', subject: 'Re: PILNE: Zalewanie garażu podziemnego',
    from_address: 'marek.kaczmarek@gmail.com', from_name: 'Marek Kaczmarek',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(25), received_at: daysAgo(25),
    body_text: `Piszę już piąty dzień i nadal nie ma żadnych konkretnych działań. Woda stoi w garażu. To jest sprawa pilna, napisałem "PILNE"! Kiedy ktoś wreszcie coś z tym zrobi?

Marek Kaczmarek`,
    has_attachments: false,
    header_message_id: R5_MSG3, header_in_reply_to: R5_MSG2, header_references: buildReferences(R5_MSG1, R5_MSG2),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R5_MSG4, graph_id: 'mock-graph-r5-004',
    conversation_id: 'conv-royal-5', subject: 'Fwd: PILNE: Zalewanie garażu podziemnego',
    from_address: 'marek.kaczmarek@gmail.com', from_name: 'Marek Kaczmarek',
    to_addresses: [{ address: 'zarzad@royal-residence.pl', name: 'Zarząd Royal Residence' }],
    cc_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    sent_at: daysAgo(22), received_at: daysAgo(22),
    body_text: `Szanowny Zarządzie,

Przekazuję korespondencję z administracją dot. zalewania garażu. Mimo pilności sprawy, od 8 dni nie podjęto żadnych realnych działań. Proszę o interwencję.

Marek Kaczmarek
ul. Królewska 15B/25, Warszawa`,
    has_attachments: false,
    header_message_id: R5_MSG4, header_in_reply_to: R5_MSG3, header_references: buildReferences(R5_MSG1, R5_MSG2, R5_MSG3),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R5_MSG5, graph_id: 'mock-graph-r5-005',
    conversation_id: 'conv-royal-5', subject: 'Re: PILNE: Zalewanie garażu podziemnego',
    from_address: 'administracja@royal-residence.pl', from_name: 'Robert Mazur',
    to_addresses: [{ address: 'marek.kaczmarek@gmail.com', name: 'Marek Kaczmarek' }],
    cc_addresses: [{ address: 'zarzad@royal-residence.pl', name: 'Zarząd Royal Residence' }],
    sent_at: daysAgo(21), received_at: daysAgo(21),
    body_text: `Szanowny Panie Marku,

Przejąłem sprawę osobiście. Firma HydroFix rozpoczęła naprawę pompy odwadniającej. Woda powinna zostać usunięta do jutra. Jeśli Pana samochód został uszkodzony, prosimy o kontakt z naszym ubezpieczycielem: PZU SA, polisa nr GR-2024-00567.

Przepraszamy za opóźnienie w reakcji.

Robert Mazur
Kierownik Administracji Royal Residence
tel. +48 22 100 2001`,
    has_attachments: false,
    header_message_id: R5_MSG5, header_in_reply_to: R5_MSG4, header_references: buildReferences(R5_MSG1, R5_MSG2, R5_MSG3, R5_MSG4),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R5_MSG6, graph_id: 'mock-graph-r5-006',
    conversation_id: 'conv-royal-5', subject: 'Re: PILNE: Zalewanie garażu podziemnego',
    from_address: 'marek.kaczmarek@gmail.com', from_name: 'Marek Kaczmarek',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(19), received_at: daysAgo(19),
    body_text: `Woda została usunięta. Niestety na felgach mojego samochodu pojawiła się rdza. Będę kontaktował się z PZU w sprawie odszkodowania.

Oczekuję też, że administracja podejmie kroki, by taka sytuacja nie powtórzyła się w przyszłości.

Marek Kaczmarek`,
    has_attachments: false,
    header_message_id: R5_MSG6, header_in_reply_to: R5_MSG5, header_references: buildReferences(R5_MSG1, R5_MSG2, R5_MSG3, R5_MSG4, R5_MSG5),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R5_MSG7, graph_id: 'mock-graph-r5-007',
    conversation_id: 'conv-royal-5', subject: 'Re: PILNE: Zalewanie garażu podziemnego',
    from_address: 'administracja@royal-residence.pl', from_name: 'Robert Mazur',
    to_addresses: [{ address: 'marek.kaczmarek@gmail.com', name: 'Marek Kaczmarek' }],
    cc_addresses: [],
    sent_at: daysAgo(18), received_at: daysAgo(18),
    body_text: `Panie Marku,

Rozumiem Pana frustrację. Zamówiliśmy dodatkową pompę odwadniającą, która zostanie zainstalowana do końca miesiąca. Wprowadzamy też cotygodniowe inspekcje garażu.

W sprawie odszkodowania proszę kontaktować się bezpośrednio z PZU — nr polisy podałem w poprzednim mailu.

Z poważaniem,
Robert Mazur`,
    has_attachments: false,
    header_message_id: R5_MSG7, header_in_reply_to: R5_MSG6, header_references: buildReferences(R5_MSG1, R5_MSG2, R5_MSG3, R5_MSG4, R5_MSG5, R5_MSG6),
    is_read: true,
  },
];

// --- Watek 6: Zmiana zarządcy (5 emaili) ---
const R6_MSG1 = '<r6-001@wp.pl>';
const R6_MSG2 = '<r6-002@royal-residence.pl>';
const R6_MSG3 = '<r6-003@wp.pl>';
const R6_MSG4 = '<r6-004@royal-residence.pl>';
const R6_MSG5 = '<r6-005@wp.pl>';

const royalThread6: MockEmail[] = [
  {
    mailbox_id: ROYAL, internet_message_id: R6_MSG1, graph_id: 'mock-graph-r6-001',
    conversation_id: 'conv-royal-6', subject: 'Zmiana zarządcy - pytania',
    from_address: 'ewa.szymanska@wp.pl', from_name: 'Ewa Szymańska',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(7), received_at: daysAgo(7),
    body_text: `Dzień dobry,

Czy to prawda, że zmienia się zarządca osiedla? Jeśli tak, proszę o informację:
1. Kto będzie nowym zarządcą?
2. Od kiedy zmiana?
3. Czy zmienią się numery kontaktowe?

Ewa Szymańska, lokal 15D/18`,
    has_attachments: false,
    header_message_id: R6_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R6_MSG2, graph_id: 'mock-graph-r6-002',
    conversation_id: 'conv-royal-6', subject: 'Re: Zmiana zarządcy - pytania',
    from_address: 'administracja@royal-residence.pl', from_name: 'Robert Mazur',
    to_addresses: [{ address: 'ewa.szymanska@wp.pl', name: 'Ewa Szymańska' }],
    cc_addresses: [],
    sent_at: daysAgo(6), received_at: daysAgo(6),
    body_text: `Szanowna Pani Ewo,

Potwierdzam — od 1 kwietnia zarząd przejmie firma AdminPro Sp. z o.o. Wszystkie numery kontaktowe i adresy email pozostaną bez zmian w okresie przejściowym (do 30 czerwca).

Szczegółowa informacja zostanie wysłana do wszystkich mieszkańców w przyszłym tygodniu.

Z poważaniem,
Robert Mazur`,
    has_attachments: false,
    header_message_id: R6_MSG2, header_in_reply_to: R6_MSG1, header_references: buildReferences(R6_MSG1),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R6_MSG3, graph_id: 'mock-graph-r6-003',
    conversation_id: 'conv-royal-6', subject: 'Re: Zmiana zarządcy - pytania',
    from_address: 'ewa.szymanska@wp.pl', from_name: 'Ewa Szymańska',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(5), received_at: daysAgo(5),
    body_text: `Dziękuję za odpowiedź. Czy nowy zarządca przejmie też dokumentację dot. remontu dachu z 2023 roku? Mam otwartą reklamację (nr RK-2023-089).

Ewa Szymańska`,
    has_attachments: false,
    header_message_id: R6_MSG3, header_in_reply_to: R6_MSG2, header_references: buildReferences(R6_MSG1, R6_MSG2),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R6_MSG4, graph_id: 'mock-graph-r6-004',
    conversation_id: 'conv-royal-6', subject: 'Re: Zmiana zarządcy - pytania',
    from_address: 'administracja@royal-residence.pl', from_name: 'Robert Mazur',
    to_addresses: [{ address: 'ewa.szymanska@wp.pl', name: 'Ewa Szymańska' }],
    cc_addresses: [],
    sent_at: daysAgo(4), received_at: daysAgo(4),
    body_text: `Pani Ewo,

Tak, cała dokumentacja techniczna i reklamacyjna zostanie przekazana nowemu zarządcy. Pani reklamacja RK-2023-089 będzie kontynuowana.

Pozdrawiam,
Robert Mazur`,
    has_attachments: false,
    header_message_id: R6_MSG4, header_in_reply_to: R6_MSG3, header_references: buildReferences(R6_MSG1, R6_MSG2, R6_MSG3),
    is_read: true,
  },
  {
    mailbox_id: ROYAL, internet_message_id: R6_MSG5, graph_id: 'mock-graph-r6-005',
    conversation_id: 'conv-royal-6', subject: 'Re: Zmiana zarządcy - pytania',
    from_address: 'ewa.szymanska@wp.pl', from_name: 'Ewa Szymańska',
    to_addresses: [{ address: 'administracja@royal-residence.pl', name: 'Administracja Royal' }],
    cc_addresses: [],
    sent_at: daysAgo(4, 2), received_at: daysAgo(4, 2),
    body_text: `Świetnie, dziękuję za wyczerpującą informację.

Pozdrawiam,
Ewa Szymańska`,
    has_attachments: false,
    header_message_id: R6_MSG5, header_in_reply_to: R6_MSG4, header_references: buildReferences(R6_MSG1, R6_MSG2, R6_MSG3, R6_MSG4),
    is_read: true,
  },
];

// ============================================================
// SADY URSYNÓW — 4 watki, ~25 emaili
// ============================================================

// --- Watek 7: Wymiana domofonu (5 emaili) ---
const S1_MSG1 = '<s1-001@sady-ursynow.pl>';
const S1_MSG2 = '<s1-002@gmail.com>';
const S1_MSG3 = '<s1-003@sady-ursynow.pl>';
const S1_MSG4 = '<s1-004@gmail.com>';
const S1_MSG5 = '<s1-005@sady-ursynow.pl>';

const sadyThread1: MockEmail[] = [
  {
    mailbox_id: SADY, internet_message_id: S1_MSG1, graph_id: 'mock-graph-s1-001',
    conversation_id: 'conv-sady-1', subject: 'Wymiana domofonu - oferty do zatwierdzenia',
    from_address: 'biuro@sady-ursynow.pl', from_name: 'Administracja Sady Ursynów',
    to_addresses: [{ address: 'rada.nadzorcza@sady-ursynow.pl', name: 'Rada Nadzorcza' }],
    cc_addresses: [],
    sent_at: daysAgo(12), received_at: daysAgo(12),
    body_text: `Szanowna Rado,

Przedstawiamy trzy oferty na wymianę systemu domofonowego:
1. DomoTech — 45 000 zł (system IP, 5 lat gwarancji)
2. SafeHome — 38 000 zł (system analogowy, 3 lata gwarancji)
3. SmartEntry — 52 000 zł (system IP z wideodomofonem, 5 lat gwarancji)

Rekomendujemy ofertę nr 1 (DomoTech) jako najlepszy stosunek jakości do ceny.

Z poważaniem,
Tomasz Grabowski
Administracja Sady Ursynów
os. Sady Ursynów 12, Warszawa
tel. 22-300-4000`,
    has_attachments: true,
    header_message_id: S1_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S1_MSG2, graph_id: 'mock-graph-s1-002',
    conversation_id: 'conv-sady-1', subject: 'Re: Wymiana domofonu - oferty do zatwierdzenia',
    from_address: 'maria.wojciechowska@gmail.com', from_name: 'Maria Wojciechowska',
    to_addresses: [{ address: 'biuro@sady-ursynow.pl', name: 'Administracja Sady Ursynów' }],
    cc_addresses: [{ address: 'rada.nadzorcza@sady-ursynow.pl', name: 'Rada Nadzorcza' }],
    sent_at: daysAgo(11), received_at: daysAgo(11),
    body_text: `Jako przewodnicząca rady nadzorczej zgadzam się z rekomendacją. Proszę o sprawdzenie referencji firmy DomoTech.

Maria Wojciechowska
Przewodnicząca Rady Nadzorczej
tel. 604-567-890`,
    has_attachments: false,
    header_message_id: S1_MSG2, header_in_reply_to: S1_MSG1, header_references: buildReferences(S1_MSG1),
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S1_MSG3, graph_id: 'mock-graph-s1-003',
    conversation_id: 'conv-sady-1', subject: 'Re: Wymiana domofonu - oferty do zatwierdzenia',
    from_address: 'biuro@sady-ursynow.pl', from_name: 'Tomasz Grabowski',
    to_addresses: [{ address: 'maria.wojciechowska@gmail.com', name: 'Maria Wojciechowska' }],
    cc_addresses: [{ address: 'rada.nadzorcza@sady-ursynow.pl', name: 'Rada Nadzorcza' }],
    sent_at: daysAgo(10), received_at: daysAgo(10),
    body_text: `Pani Mario,

Sprawdziłem referencje DomoTech:
- os. Wilanów Park — wymiana 2023, pozytywna opinia zarządcy
- os. Mokotów Gardens — wymiana 2024, bez zastrzeżeń
- NIP firmy: 5213456789, KRS: 0000567890

Czy możemy przystąpić do podpisania umowy?

Tomasz Grabowski`,
    has_attachments: false,
    header_message_id: S1_MSG3, header_in_reply_to: S1_MSG2, header_references: buildReferences(S1_MSG1, S1_MSG2),
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S1_MSG4, graph_id: 'mock-graph-s1-004',
    conversation_id: 'conv-sady-1', subject: 'Re: Wymiana domofonu - oferty do zatwierdzenia',
    from_address: 'maria.wojciechowska@gmail.com', from_name: 'Maria Wojciechowska',
    to_addresses: [{ address: 'biuro@sady-ursynow.pl', name: 'Administracja Sady Ursynów' }],
    cc_addresses: [],
    sent_at: daysAgo(9), received_at: daysAgo(9),
    body_text: `Referencje wyglądają dobrze. Zatwierdzam. Proszę przygotować umowę do podpisu.

Maria Wojciechowska`,
    has_attachments: false,
    header_message_id: S1_MSG4, header_in_reply_to: S1_MSG3, header_references: buildReferences(S1_MSG1, S1_MSG2, S1_MSG3),
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S1_MSG5, graph_id: 'mock-graph-s1-005',
    conversation_id: 'conv-sady-1', subject: 'Re: Wymiana domofonu - oferty do zatwierdzenia',
    from_address: 'biuro@sady-ursynow.pl', from_name: 'Tomasz Grabowski',
    to_addresses: [{ address: 'maria.wojciechowska@gmail.com', name: 'Maria Wojciechowska' }],
    cc_addresses: [],
    sent_at: daysAgo(8), received_at: daysAgo(8),
    body_text: `Umowa przygotowana i czeka na podpis w biurze administracji (os. Sady Ursynów 12, pok. 3). Termin realizacji: kwiecień 2026.

Pozdrawiam,
Tomasz Grabowski`,
    has_attachments: true,
    header_message_id: S1_MSG5, header_in_reply_to: S1_MSG4, header_references: buildReferences(S1_MSG1, S1_MSG2, S1_MSG3, S1_MSG4),
    is_read: true,
  },
];

// --- Watek 8: Opłaty parkingowe (4 emaile) ---
const S2_MSG1 = '<s2-001@onet.pl>';
const S2_MSG2 = '<s2-002@sady-ursynow.pl>';
const S2_MSG3 = '<s2-003@onet.pl>';
const S2_MSG4 = '<s2-004@sady-ursynow.pl>';

const sadyThread2: MockEmail[] = [
  {
    mailbox_id: SADY, internet_message_id: S2_MSG1, graph_id: 'mock-graph-s2-001',
    conversation_id: 'conv-sady-2', subject: 'Pytanie o opłaty za miejsce parkingowe',
    from_address: 'adam.zielinski@onet.pl', from_name: 'Adam Zieliński',
    to_addresses: [{ address: 'biuro@sady-ursynow.pl', name: 'Administracja Sady Ursynów' }],
    cc_addresses: [],
    sent_at: daysAgo(8), received_at: daysAgo(8),
    body_text: `Dzień dobry,

Chciałbym zapytać o stawki za najem miejsca parkingowego w garażu podziemnym. Czy są wolne miejsca? Jakie dokumenty są potrzebne?

Mieszkam w bloku 14, lokal 14/22.

Adam Zieliński
tel. 507-890-123`,
    has_attachments: false,
    header_message_id: S2_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S2_MSG2, graph_id: 'mock-graph-s2-002',
    conversation_id: 'conv-sady-2', subject: 'Re: Pytanie o opłaty za miejsce parkingowe',
    from_address: 'biuro@sady-ursynow.pl', from_name: 'Administracja Sady Ursynów',
    to_addresses: [{ address: 'adam.zielinski@onet.pl', name: 'Adam Zieliński' }],
    cc_addresses: [],
    sent_at: daysAgo(7), received_at: daysAgo(7),
    body_text: `Szanowny Panie Adamie,

Aktualnie dostępne są 3 miejsca parkingowe. Stawka wynosi 250 zł/miesiąc (netto). Potrzebne dokumenty:
- Dowód osobisty (do wglądu)
- Dowód rejestracyjny pojazdu
- Podpisana umowa najmu

Zapraszamy do biura (blok 12, parter) w godz. 8:00-16:00.

Pozdrawiam,
Tomasz Grabowski`,
    has_attachments: false,
    header_message_id: S2_MSG2, header_in_reply_to: S2_MSG1, header_references: buildReferences(S2_MSG1),
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S2_MSG3, graph_id: 'mock-graph-s2-003',
    conversation_id: 'conv-sady-2', subject: 'Re: Pytanie o opłaty za miejsce parkingowe',
    from_address: 'adam.zielinski@onet.pl', from_name: 'Adam Zieliński',
    to_addresses: [{ address: 'biuro@sady-ursynow.pl', name: 'Administracja Sady Ursynów' }],
    cc_addresses: [],
    sent_at: daysAgo(6), received_at: daysAgo(6),
    body_text: `Dziękuję. Przyjdę jutro z dokumentami. Czy można wybrać konkretne miejsce?

Adam Zieliński`,
    has_attachments: false,
    header_message_id: S2_MSG3, header_in_reply_to: S2_MSG2, header_references: buildReferences(S2_MSG1, S2_MSG2),
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S2_MSG4, graph_id: 'mock-graph-s2-004',
    conversation_id: 'conv-sady-2', subject: 'Re: Pytanie o opłaty za miejsce parkingowe',
    from_address: 'biuro@sady-ursynow.pl', from_name: 'Tomasz Grabowski',
    to_addresses: [{ address: 'adam.zielinski@onet.pl', name: 'Adam Zieliński' }],
    cc_addresses: [],
    sent_at: daysAgo(6, 2), received_at: daysAgo(6, 2),
    body_text: `Tak, wolne miejsca to: B-15, B-22, C-08. Może Pan obejrzeć je przed podpisaniem umowy.

Do zobaczenia,
Tomasz Grabowski`,
    has_attachments: false,
    header_message_id: S2_MSG4, header_in_reply_to: S2_MSG3, header_references: buildReferences(S2_MSG1, S2_MSG2, S2_MSG3),
    is_read: true,
  },
];

// --- Watek 9: Przegląd gazowy (3 emaile, szybka odpowiedz) ---
const S3_MSG1 = '<s3-001@sady-ursynow.pl>';
const S3_MSG2 = '<s3-002@gmail.com>';
const S3_MSG3 = '<s3-003@sady-ursynow.pl>';

const sadyThread3: MockEmail[] = [
  {
    mailbox_id: SADY, internet_message_id: S3_MSG1, graph_id: 'mock-graph-s3-001',
    conversation_id: 'conv-sady-3', subject: 'Przegląd instalacji gazowej - termin',
    from_address: 'biuro@sady-ursynow.pl', from_name: 'Administracja Sady Ursynów',
    to_addresses: [{ address: 'mieszkancy@sady-ursynow.pl', name: 'Wszyscy mieszkańcy' }],
    cc_addresses: [],
    sent_at: daysAgo(5), received_at: daysAgo(5),
    body_text: `Szanowni Mieszkańcy,

Przypominamy o obowiązkowym przeglądzie instalacji gazowej, który odbędzie się w dniach 18-20 marca.

Prosimy o zapewnienie dostępu do mieszkań w godz. 9:00-17:00. W przypadku nieobecności prosimy o kontakt z biurem w celu ustalenia indywidualnego terminu.

Przegląd wykona firma GazSerwis (uprawniony technik: Stanisław Kopeć, świadectwo kwalifikacyjne nr E-1234/2023).

Administracja Sady Ursynów`,
    has_attachments: false,
    header_message_id: S3_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S3_MSG2, graph_id: 'mock-graph-s3-002',
    conversation_id: 'conv-sady-3', subject: 'Re: Przegląd instalacji gazowej - termin',
    from_address: 'dorota.kaminska@gmail.com', from_name: 'Dorota Kamińska',
    to_addresses: [{ address: 'biuro@sady-ursynow.pl', name: 'Administracja Sady Ursynów' }],
    cc_addresses: [],
    sent_at: daysAgo(5, 3), received_at: daysAgo(5, 3),
    body_text: `Dzień dobry,

Niestety nie będę w domu 18-20 marca (służbowy wyjazd). Czy mogę umówić się na inny termin? Lokal 16/7.

Dorota Kamińska
tel. 609-234-567`,
    has_attachments: false,
    header_message_id: S3_MSG2, header_in_reply_to: S3_MSG1, header_references: buildReferences(S3_MSG1),
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S3_MSG3, graph_id: 'mock-graph-s3-003',
    conversation_id: 'conv-sady-3', subject: 'Re: Przegląd instalacji gazowej - termin',
    from_address: 'biuro@sady-ursynow.pl', from_name: 'Tomasz Grabowski',
    to_addresses: [{ address: 'dorota.kaminska@gmail.com', name: 'Dorota Kamińska' }],
    cc_addresses: [],
    sent_at: daysAgo(4, 20), received_at: daysAgo(4, 20),
    body_text: `Pani Doroto,

Oczywiście. Dodatkowy termin: 22 marca (piątek), godz. 10:00-12:00. Czy Pani odpowiada?

Pozdrawiam,
Tomasz Grabowski`,
    has_attachments: false,
    header_message_id: S3_MSG3, header_in_reply_to: S3_MSG2, header_references: buildReferences(S3_MSG1, S3_MSG2),
    is_read: true,
  },
];

// --- Watek 10: Oświetlenie parkingu (4 emaile) ---
const S4_MSG1 = '<s4-001@wp.pl>';
const S4_MSG2 = '<s4-002@sady-ursynow.pl>';
const S4_MSG3 = '<s4-003@wp.pl>';
const S4_MSG4 = '<s4-004@sady-ursynow.pl>';

const sadyThread4: MockEmail[] = [
  {
    mailbox_id: SADY, internet_message_id: S4_MSG1, graph_id: 'mock-graph-s4-001',
    conversation_id: 'conv-sady-4', subject: 'Usterka oświetlenia na parkingu naziemnym',
    from_address: 'jan.michalski@wp.pl', from_name: 'Jan Michalski',
    to_addresses: [{ address: 'biuro@sady-ursynow.pl', name: 'Administracja Sady Ursynów' }],
    cc_addresses: [],
    sent_at: daysAgo(4), received_at: daysAgo(4),
    body_text: `Dzień dobry,

Na parkingu naziemnym od strony bloku 16 nie działa oświetlenie (4 latarnie z 6). Jest bardzo ciemno wieczorem i czuję się niebezpiecznie.

Proszę o naprawę.

Jan Michalski
blok 16, lokal 16/31
tel. 510-111-222`,
    has_attachments: false,
    header_message_id: S4_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S4_MSG2, graph_id: 'mock-graph-s4-002',
    conversation_id: 'conv-sady-4', subject: 'Re: Usterka oświetlenia na parkingu naziemnym',
    from_address: 'biuro@sady-ursynow.pl', from_name: 'Tomasz Grabowski',
    to_addresses: [{ address: 'jan.michalski@wp.pl', name: 'Jan Michalski' }],
    cc_addresses: [],
    sent_at: daysAgo(3, 18), received_at: daysAgo(3, 18),
    body_text: `Panie Janie,

Dziękuję za zgłoszenie. Zleciliśmy naprawę firmie ElektroBud. Planowany termin: piątek tego tygodnia.

Pozdrawiam,
Tomasz Grabowski`,
    has_attachments: false,
    header_message_id: S4_MSG2, header_in_reply_to: S4_MSG1, header_references: buildReferences(S4_MSG1),
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S4_MSG3, graph_id: 'mock-graph-s4-003',
    conversation_id: 'conv-sady-4', subject: 'Re: Usterka oświetlenia na parkingu naziemnym',
    from_address: 'jan.michalski@wp.pl', from_name: 'Jan Michalski',
    to_addresses: [{ address: 'biuro@sady-ursynow.pl', name: 'Administracja Sady Ursynów' }],
    cc_addresses: [],
    sent_at: daysAgo(1), received_at: daysAgo(1),
    body_text: `Oświetlenie naprawione, wszystkie latarnie działają. Dziękuję za szybką reakcję.

Jan Michalski`,
    has_attachments: false,
    header_message_id: S4_MSG3, header_in_reply_to: S4_MSG2, header_references: buildReferences(S4_MSG1, S4_MSG2),
    is_read: true,
  },
  {
    mailbox_id: SADY, internet_message_id: S4_MSG4, graph_id: 'mock-graph-s4-004',
    conversation_id: 'conv-sady-4', subject: 'Re: Usterka oświetlenia na parkingu naziemnym',
    from_address: 'biuro@sady-ursynow.pl', from_name: 'Tomasz Grabowski',
    to_addresses: [{ address: 'jan.michalski@wp.pl', name: 'Jan Michalski' }],
    cc_addresses: [],
    sent_at: daysAgo(1, 2), received_at: daysAgo(1, 2),
    body_text: `Cieszę się. Wymieniono 4 żarówki LED i jeden bezpiecznik. Gdyby coś się jeszcze pojawiło, proszę pisać.

Pozdrawiam,
Tomasz Grabowski`,
    has_attachments: false,
    header_message_id: S4_MSG4, header_in_reply_to: S4_MSG3, header_references: buildReferences(S4_MSG1, S4_MSG2, S4_MSG3),
    is_read: true,
  },
];

// ============================================================
// RZECZNIK ROBYG — 3 watki, ~15 emaili (slaba komunikacja)
// ============================================================

// --- Watek 11: Brak odpowiedzi na reklamację wilgoci (6 emaili) ---
const B1_MSG1 = '<b1-001@gmail.com>';
const B1_MSG2 = '<b1-002@gmail.com>';
const B1_MSG3 = '<b1-003@robyg.com.pl>';
const B1_MSG4 = '<b1-004@gmail.com>';
const B1_MSG5 = '<b1-005@robyg.com.pl>';
const B1_MSG6 = '<b1-006@gmail.com>';

const robygThread1: MockEmail[] = [
  {
    mailbox_id: ROBYG, internet_message_id: B1_MSG1, graph_id: 'mock-graph-b1-001',
    conversation_id: 'conv-robyg-1', subject: 'Reklamacja - wilgoć i pleśń w łazience',
    from_address: 'karolina.mazur@gmail.com', from_name: 'Karolina Mazur',
    to_addresses: [{ address: 'rzecznik@robyg.com.pl', name: 'Rzecznik Robyg' }],
    cc_addresses: [],
    sent_at: daysAgo(28), received_at: daysAgo(28),
    body_text: `Szanowni Państwo,

Zgłaszam problem z wilgocią i pleśnią w łazience mojego mieszkania (ul. Ludwinowska 8/15, Warszawa). Problem pojawił się 3 miesiące temu i systematycznie się pogarsza.

Na ścianach w łazience widoczna jest czarna pleśń, a wilgotność jest na tyle wysoka, że farba się łuszczy. Podejrzewam wadę izolacji.

Mieszkanie zostało oddane w styczniu 2024 i jest na gwarancji.

Proszę o pilną interwencję.

Karolina Mazur
ul. Ludwinowska 8/15, 02-856 Warszawa
PESEL: 92031567890
tel. 606-789-012`,
    has_attachments: true,
    header_message_id: B1_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B1_MSG2, graph_id: 'mock-graph-b1-002',
    conversation_id: 'conv-robyg-1', subject: 'Re: Reklamacja - wilgoć i pleśń w łazience',
    from_address: 'karolina.mazur@gmail.com', from_name: 'Karolina Mazur',
    to_addresses: [{ address: 'rzecznik@robyg.com.pl', name: 'Rzecznik Robyg' }],
    cc_addresses: [],
    sent_at: daysAgo(21), received_at: daysAgo(21),
    body_text: `Dzień dobry,

Minął tydzień od mojego zgłoszenia i nie otrzymałam żadnej odpowiedzi. Proszę o informację kiedy mogę spodziewać się reakcji na reklamację.

Karolina Mazur`,
    has_attachments: false,
    header_message_id: B1_MSG2, header_in_reply_to: B1_MSG1, header_references: buildReferences(B1_MSG1),
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B1_MSG3, graph_id: 'mock-graph-b1-003',
    conversation_id: 'conv-robyg-1', subject: 'RE: Reklamacja - wilgoć i pleśń w łazience',
    from_address: 'rzecznik@robyg.com.pl', from_name: 'Biuro Rzecznika Robyg',
    to_addresses: [{ address: 'karolina.mazur@gmail.com', name: 'Karolina Mazur' }],
    cc_addresses: [],
    sent_at: daysAgo(14), received_at: daysAgo(14),
    body_text: `Szanowna Pani,

Potwierdzamy otrzymanie zgłoszenia reklamacyjnego. Sprawa została zarejestrowana pod numerem RK/2026/0342. Skontaktujemy się w celu umówienia oględzin.

Z poważaniem,
Biuro Rzecznika Robyg`,
    has_attachments: false,
    header_message_id: B1_MSG3, header_in_reply_to: B1_MSG2, header_references: buildReferences(B1_MSG1, B1_MSG2),
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B1_MSG4, graph_id: 'mock-graph-b1-004',
    conversation_id: 'conv-robyg-1', subject: 'Re: Reklamacja - wilgoć i pleśń w łazience',
    from_address: 'karolina.mazur@gmail.com', from_name: 'Karolina Mazur',
    to_addresses: [{ address: 'rzecznik@robyg.com.pl', name: 'Rzecznik Robyg' }],
    cc_addresses: [],
    sent_at: daysAgo(7), received_at: daysAgo(7),
    body_text: `Minęły 3 tygodnie od zgłoszenia. Odpowiedź, którą otrzymałam, to szablon potwierdzający przyjęcie — zero konkretu. Nikt się ze mną nie kontaktował w sprawie oględzin.

Pleśń się rozrasta. Jeśli nie otrzymam konkretnej odpowiedzi w ciągu 3 dni, zgłoszę sprawę do UOKiK i Powiatowego Inspektora Nadzoru Budowlanego.

Karolina Mazur`,
    has_attachments: true,
    header_message_id: B1_MSG4, header_in_reply_to: B1_MSG3, header_references: buildReferences(B1_MSG1, B1_MSG2, B1_MSG3),
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B1_MSG5, graph_id: 'mock-graph-b1-005',
    conversation_id: 'conv-robyg-1', subject: 'RE: Reklamacja - wilgoć i pleśń w łazience',
    from_address: 'rzecznik@robyg.com.pl', from_name: 'Biuro Rzecznika Robyg',
    to_addresses: [{ address: 'karolina.mazur@gmail.com', name: 'Karolina Mazur' }],
    cc_addresses: [],
    sent_at: daysAgo(5), received_at: daysAgo(5),
    body_text: `Szanowna Pani Karolino,

Przepraszamy za opóźnienie. Nasz dział techniczny skontaktuje się z Panią telefonicznie w celu ustalenia terminu oględzin. Prosimy o cierpliwość.

Z poważaniem,
Biuro Rzecznika Robyg`,
    has_attachments: false,
    header_message_id: B1_MSG5, header_in_reply_to: B1_MSG4, header_references: buildReferences(B1_MSG1, B1_MSG2, B1_MSG3, B1_MSG4),
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B1_MSG6, graph_id: 'mock-graph-b1-006',
    conversation_id: 'conv-robyg-1', subject: 'Re: Reklamacja - wilgoć i pleśń w łazience',
    from_address: 'karolina.mazur@gmail.com', from_name: 'Karolina Mazur',
    to_addresses: [{ address: 'rzecznik@robyg.com.pl', name: 'Rzecznik Robyg' }],
    cc_addresses: [],
    sent_at: daysAgo(3), received_at: daysAgo(3),
    body_text: `"Prosimy o cierpliwość" — to jedyne co słyszę od miesiąca. Nadal nikt nie zadzwonił. Składam oficjalną skargę i wysyłam pismo do PINB.

Karolina Mazur`,
    has_attachments: false,
    header_message_id: B1_MSG6, header_in_reply_to: B1_MSG5, header_references: buildReferences(B1_MSG1, B1_MSG2, B1_MSG3, B1_MSG4, B1_MSG5),
    is_read: true,
  },
];

// --- Watek 12: Niesprawna brama (4 emaile, powtarzający się problem) ---
const B2_MSG1 = '<b2-001@wp.pl>';
const B2_MSG2 = '<b2-002@robyg.com.pl>';
const B2_MSG3 = '<b2-003@wp.pl>';
const B2_MSG4 = '<b2-004@robyg.com.pl>';

const robygThread2: MockEmail[] = [
  {
    mailbox_id: ROBYG, internet_message_id: B2_MSG1, graph_id: 'mock-graph-b2-001',
    conversation_id: 'conv-robyg-2', subject: 'Ponowna awaria bramy wjazdowej',
    from_address: 'robert.jankowski@wp.pl', from_name: 'Robert Jankowski',
    to_addresses: [{ address: 'rzecznik@robyg.com.pl', name: 'Rzecznik Robyg' }],
    cc_addresses: [],
    sent_at: daysAgo(10), received_at: daysAgo(10),
    body_text: `Dzień dobry,

Ponownie zgłaszam awarię bramy wjazdowej do garażu podziemnego przy ul. Ludwinowskiej 10. To CZWARTA awaria w ciągu ostatnich 2 miesięcy!

Brama nie reaguje na pilota ani na przycisk. Musiałem zostawić samochód na zewnątrz.

Poprzednie zgłoszenia: RK/2026/0287, RK/2026/0301, RK/2026/0318.

Robert Jankowski
ul. Ludwinowska 10/33
tel. 502-345-678`,
    has_attachments: false,
    header_message_id: B2_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B2_MSG2, graph_id: 'mock-graph-b2-002',
    conversation_id: 'conv-robyg-2', subject: 'RE: Ponowna awaria bramy wjazdowej',
    from_address: 'rzecznik@robyg.com.pl', from_name: 'Biuro Rzecznika Robyg',
    to_addresses: [{ address: 'robert.jankowski@wp.pl', name: 'Robert Jankowski' }],
    cc_addresses: [],
    sent_at: daysAgo(7), received_at: daysAgo(7),
    body_text: `Szanowny Panie,

Zgłoszenie zostało przekazane do działu technicznego. Serwis bramy został wezwany.

Z poważaniem,
Biuro Rzecznika Robyg`,
    has_attachments: false,
    header_message_id: B2_MSG2, header_in_reply_to: B2_MSG1, header_references: buildReferences(B2_MSG1),
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B2_MSG3, graph_id: 'mock-graph-b2-003',
    conversation_id: 'conv-robyg-2', subject: 'Re: Ponowna awaria bramy wjazdowej',
    from_address: 'robert.jankowski@wp.pl', from_name: 'Robert Jankowski',
    to_addresses: [{ address: 'rzecznik@robyg.com.pl', name: 'Rzecznik Robyg' }],
    cc_addresses: [],
    sent_at: daysAgo(5), received_at: daysAgo(5),
    body_text: `"Serwis został wezwany" — to samo słyszę za każdym razem. Brama dalej nie działa. Może zamiast ciągle naprawiać, czas wymienić ją na nową?

Żądam pisemnej odpowiedzi z planem rozwiązania tego problemu na stałe.

Robert Jankowski`,
    has_attachments: false,
    header_message_id: B2_MSG3, header_in_reply_to: B2_MSG2, header_references: buildReferences(B2_MSG1, B2_MSG2),
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B2_MSG4, graph_id: 'mock-graph-b2-004',
    conversation_id: 'conv-robyg-2', subject: 'RE: Ponowna awaria bramy wjazdowej',
    from_address: 'rzecznik@robyg.com.pl', from_name: 'Biuro Rzecznika Robyg',
    to_addresses: [{ address: 'robert.jankowski@wp.pl', name: 'Robert Jankowski' }],
    cc_addresses: [],
    sent_at: daysAgo(2), received_at: daysAgo(2),
    body_text: `Szanowny Panie Robercie,

Serwis naprawił bramę (wymiana silnika napędowego). Przeprowadzamy analizę przyczyn powtarzających się awarii. Pisemna odpowiedź z planem działania zostanie wysłana do końca tygodnia.

Z poważaniem,
Biuro Rzecznika Robyg`,
    has_attachments: false,
    header_message_id: B2_MSG4, header_in_reply_to: B2_MSG3, header_references: buildReferences(B2_MSG1, B2_MSG2, B2_MSG3),
    is_read: true,
  },
];

// --- Watek 13: Protokół zebrania (3 emaile, brak odpowiedzi) ---
const B3_MSG1 = '<b3-001@onet.pl>';
const B3_MSG2 = '<b3-002@onet.pl>';
const B3_MSG3 = '<b3-003@robyg.com.pl>';

const robygThread3: MockEmail[] = [
  {
    mailbox_id: ROBYG, internet_message_id: B3_MSG1, graph_id: 'mock-graph-b3-001',
    conversation_id: 'conv-robyg-3', subject: 'Prośba o protokół z zebrania wspólnoty',
    from_address: 'teresa.olszewska@onet.pl', from_name: 'Teresa Olszewska',
    to_addresses: [{ address: 'rzecznik@robyg.com.pl', name: 'Rzecznik Robyg' }],
    cc_addresses: [],
    sent_at: daysAgo(15), received_at: daysAgo(15),
    body_text: `Dzień dobry,

Proszę o przesłanie protokołu z zebrania wspólnoty mieszkaniowej, które odbyło się 25 stycznia 2026 r. Nie mogłam uczestniczyć osobiście.

Teresa Olszewska
ul. Ludwinowska 12/7
tel. 601-456-789`,
    has_attachments: false,
    header_message_id: B3_MSG1, header_in_reply_to: null, header_references: [],
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B3_MSG2, graph_id: 'mock-graph-b3-002',
    conversation_id: 'conv-robyg-3', subject: 'Re: Prośba o protokół z zebrania wspólnoty',
    from_address: 'teresa.olszewska@onet.pl', from_name: 'Teresa Olszewska',
    to_addresses: [{ address: 'rzecznik@robyg.com.pl', name: 'Rzecznik Robyg' }],
    cc_addresses: [],
    sent_at: daysAgo(8), received_at: daysAgo(8),
    body_text: `Ponownie proszę o protokół z zebrania wspólnoty z 25 stycznia. Minął tydzień od mojej prośby i nie otrzymałam żadnej odpowiedzi.

Teresa Olszewska`,
    has_attachments: false,
    header_message_id: B3_MSG2, header_in_reply_to: B3_MSG1, header_references: buildReferences(B3_MSG1),
    is_read: true,
  },
  {
    mailbox_id: ROBYG, internet_message_id: B3_MSG3, graph_id: 'mock-graph-b3-003',
    conversation_id: 'conv-robyg-3', subject: 'RE: Prośba o protokół z zebrania wspólnoty',
    from_address: 'rzecznik@robyg.com.pl', from_name: 'Biuro Rzecznika Robyg',
    to_addresses: [{ address: 'teresa.olszewska@onet.pl', name: 'Teresa Olszewska' }],
    cc_addresses: [],
    sent_at: daysAgo(3), received_at: daysAgo(3),
    body_text: `Szanowna Pani,

Protokół jest w trakcie przygotowania i zostanie przesłany w najbliższym czasie.

Z poważaniem,
Biuro Rzecznika Robyg`,
    has_attachments: false,
    header_message_id: B3_MSG3, header_in_reply_to: B3_MSG2, header_references: buildReferences(B3_MSG1, B3_MSG2),
    is_read: true,
  },
];

// ============================================================
// EKSPORT
// ============================================================

export const ALL_MOCK_EMAILS: MockEmail[] = [
  // Royal Residence (6 watkow, 35 emaili)
  ...royalThread1,   // 8 emaili — awaria windy
  ...royalThread2,   // 6 emaili — hałas z budowy
  ...royalThread3,   // 5 emaili — rozliczenie ogrzewania
  ...royalThread4,   // 4 emaile — remont klatki
  ...royalThread5,   // 7 emaili — zalewanie garażu
  ...royalThread6,   // 5 emaili — zmiana zarządcy
  // Sady Ursynów (4 watki, 16 emaili)
  ...sadyThread1,    // 5 emaili — wymiana domofonu
  ...sadyThread2,    // 4 emaile — opłaty parkingowe
  ...sadyThread3,    // 3 emaile — przegląd gazowy
  ...sadyThread4,    // 4 emaile — oświetlenie parkingu
  // Rzecznik Robyg (3 watki, 13 emaili)
  ...robygThread1,   // 6 emaili — wilgoć i pleśń (brak odpowiedzi)
  ...robygThread2,   // 4 emaile — brama wjazdowa (powtarzający się problem)
  ...robygThread3,   // 3 emaile — protokół zebrania (brak odpowiedzi)
];

// Total: 13 watkow, 64 emaile
