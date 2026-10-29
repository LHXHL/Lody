import type { MachineId } from '@lody/shared';
import { activeWorkspaceRuntimeAtom } from '@/atoms/runtime';
import { usePlatformWorkspaces } from '@lody/platform/react';
import { localMachineIdAtom } from '@/atoms/local-probe';
import { useTranslation } from 'react-i18next';
import { workspaceFeatureUnavailableMessage } from '@/lib/workspace-feature';
import { useAtomValue } from 'jotai';
import { workspaceContentModeAtom } from '@/atoms/workspace-content-mode';
import {
  workspaceSupports,
  type WorkspaceRestrictedFeature,
} from '@lody/shared/workspace-streams-content';

/** Local display guard. The operation must also check its explicit runtime/content. */
export function useWorkspaceFeature(feature: WorkspaceRestrictedFeature): boolean {
  const mode = useAtomValue(workspaceContentModeAtom);
  const encrypted = Boolean(
    mode?.descriptor && 'contentMode' in mode.descriptor && mode.descriptor.contentMode === 'e2ee'
  );
  return workspaceSupports({ mode: encrypted ? 'protected' : 'plaintext' }, feature);
}

/** An absent reason means supported; callers use the same verdict and copy. */
export function useWorkspaceFeatureReason(feature: WorkspaceRestrictedFeature): string | undefined {
  const allowed = useWorkspaceFeature(feature);
  const { t } = useTranslation();
  return allowed ? undefined : workspaceFeatureUnavailableMessage(feature, t);
}

/** Local IPC keeps its existing route; only unsupported remote controls are hidden. */
export function useMachineRpcFeatureReason(
  machineId: MachineId | string | null | undefined
): string | undefined {
  const reason = useWorkspaceFeatureReason('rpc');
  const localMachineId = useAtomValue(localMachineIdAtom);
  return machineId && machineId === localMachineId ? undefined : reason;
}

/** Legacy plaintext catalogs are refused even after an encrypted device joins.
 * This is a display/query choice; it never grants access to a machine or transport.
 */
export function useLegacyWorkspaceQueriesEnabled(workspaceId: string | null | undefined): boolean {
  const mode = useAtomValue(workspaceContentModeAtom);
  const runtime = useAtomValue(activeWorkspaceRuntimeAtom);
  const workspacesState = usePlatformWorkspaces();
  if (!workspaceId) return false;
  return !(
    (mode?.workspaceId === workspaceId &&
      mode.descriptor &&
      'contentMode' in mode.descriptor &&
      mode.descriptor.contentMode === 'e2ee') ||
    (runtime?.workspaceId === workspaceId && runtime.contentMode === 'e2ee') ||
    (workspacesState.status === 'ready' &&
      workspacesState.workspaces.some(
        (workspace) => workspace.id === workspaceId && workspace.contentMode === 'e2ee'
      ))
  );
}
