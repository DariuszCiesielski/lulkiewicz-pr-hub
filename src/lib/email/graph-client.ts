import { Client } from '@microsoft/microsoft-graph-client';

/**
 * Create initialized Microsoft Graph client with the given access token.
 *
 * Usage:
 *   const token = await getAccessToken(credentials);
 *   const client = createGraphClient(token);
 *   const messages = await client.api('/me/messages').top(100).get();
 */
export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}
