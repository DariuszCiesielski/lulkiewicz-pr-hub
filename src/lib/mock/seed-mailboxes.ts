/**
 * Mock mailbox definitions for seeding.
 * 3 mailboxes representing real client estates.
 */

import { mockUuid } from './seed-utils';

export interface MockMailbox {
  id: string;
  email_address: string;
  display_name: string;
  connection_type: 'ropc';
  tenant_id: string;
  client_id: string;
  sync_status: 'synced';
  last_sync_at: string;
  total_emails: number;
}

export const MOCK_MAILBOXES: MockMailbox[] = [
  {
    id: mockUuid('royal'),
    email_address: 'administracja@royal-residence.pl',
    display_name: '[MOCK] Royal Residence',
    connection_type: 'ropc',
    tenant_id: 'mock-tenant',
    client_id: 'mock-client',
    sync_status: 'synced',
    last_sync_at: new Date().toISOString(),
    total_emails: 40,
  },
  {
    id: mockUuid('sady-ursynow'),
    email_address: 'biuro@sady-ursynow.pl',
    display_name: '[MOCK] Sady Ursynów',
    connection_type: 'ropc',
    tenant_id: 'mock-tenant',
    client_id: 'mock-client',
    sync_status: 'synced',
    last_sync_at: new Date().toISOString(),
    total_emails: 25,
  },
  {
    id: mockUuid('rzecznik-robyg'),
    email_address: 'rzecznik@robyg.com.pl',
    display_name: '[MOCK] Rzecznik Robyg',
    connection_type: 'ropc',
    tenant_id: 'mock-tenant',
    client_id: 'mock-client',
    sync_status: 'synced',
    last_sync_at: new Date().toISOString(),
    total_emails: 15,
  },
];
