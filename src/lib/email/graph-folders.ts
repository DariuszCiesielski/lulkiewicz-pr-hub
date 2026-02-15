import type { Client } from '@microsoft/microsoft-graph-client';

/**
 * Well-known folder names to EXCLUDE from sync.
 * - drafts: wersje robocze (nie wysłane)
 * - junkemail: spam
 * - deleteditems: kosz (usunięte maile)
 */
const EXCLUDED_FOLDER_NAMES = ['drafts', 'junkemail', 'deleteditems'];

/**
 * Fetch IDs of mail folders to exclude from sync.
 * Uses Graph API well-known folder names.
 *
 * Returns array of folder IDs (parentFolderId format).
 */
export async function getExcludedFolderIds(
  graphClient: Client,
  emailAddress: string
): Promise<string[]> {
  const excludedIds: string[] = [];

  for (const folderName of EXCLUDED_FOLDER_NAMES) {
    try {
      const folder = await graphClient
        .api(`/users/${emailAddress}/mailFolders/${folderName}`)
        .select('id')
        .get();

      if (folder?.id) {
        excludedIds.push(folder.id);
      }
    } catch {
      // Folder may not exist — skip silently
      console.warn(`Could not fetch folder '${folderName}' for ${emailAddress}`);
    }
  }

  return excludedIds;
}
