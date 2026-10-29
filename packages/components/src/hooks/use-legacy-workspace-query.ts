import type { CloudQuery } from '@lody/platform';
import { useCloudQuery } from '@lody/platform/react';
import { useLegacyWorkspaceQueriesEnabled } from './use-workspace-feature';

/** Only for legacy queries whose backend refuses encrypted workspaces. Control,
 * billing, and encrypted sharing operations keep their own supported paths. */
export function useLegacyWorkspaceQuery<Args extends { workspaceId: string }, Result>(
  operation: CloudQuery<Args, Result>,
  args: Args | 'skip'
): Result | undefined {
  const enabled = useLegacyWorkspaceQueriesEnabled(args === 'skip' ? null : args.workspaceId);
  return useCloudQuery(operation, enabled ? args : 'skip');
}
