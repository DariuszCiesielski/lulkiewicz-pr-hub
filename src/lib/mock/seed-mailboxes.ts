/**
 * Mock mailbox definitions for seeding.
 * 3 fictional demo mailboxes.
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
  analysis_profile: 'communication_audit' | 'case_analytics';
  cc_filter_mode: 'off' | 'never_in_to' | 'first_email_cc';
}

export const MOCK_MAILBOXES: MockMailbox[] = [
  {
    id: mockUuid('royal'),
    email_address: 'kontakt@demo-royal.example',
    display_name: '[MOCK] Royal Residence',
    connection_type: 'ropc',
    tenant_id: 'mock-tenant',
    client_id: 'mock-client',
    sync_status: 'synced',
    last_sync_at: new Date().toISOString(),
    total_emails: 40,
    analysis_profile: 'communication_audit',
    cc_filter_mode: 'off',
  },
  {
    id: mockUuid('sady-ursynow'),
    email_address: 'biuro@demo-sady.example',
    display_name: '[MOCK] Sady Ursynów',
    connection_type: 'ropc',
    tenant_id: 'mock-tenant',
    client_id: 'mock-client',
    sync_status: 'synced',
    last_sync_at: new Date().toISOString(),
    total_emails: 25,
    analysis_profile: 'communication_audit',
    cc_filter_mode: 'off',
  },
  {
    id: mockUuid('rzecznik-robyg'),
    email_address: 'rzecznik@demo-developer.example',
    display_name: '[MOCK] Rzecznik Robyg',
    connection_type: 'ropc',
    tenant_id: 'mock-tenant',
    client_id: 'mock-client',
    sync_status: 'synced',
    last_sync_at: new Date().toISOString(),
    total_emails: 15,
    analysis_profile: 'case_analytics',
    cc_filter_mode: 'never_in_to',
  },
];
