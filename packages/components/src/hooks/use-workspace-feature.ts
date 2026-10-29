import { currentWorkspaceIdAtom, currentWorkspaceSlugAtom } from '@/atoms/workspace-context';
import { useWorkspaceRouteTargetSlug } from '../providers/workspace-route-target';
import { userAtom } from '@/atoms';
import type { MachineId } from '@lody/shared';
import { activeWorkspaceRuntimeAtom } from '@/atoms/runtime';
import { usePlatform, usePlatformWorkspaces } from '@lody/platform/react';
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

export type LegacyWorkspaceQueryStatus = 'pending' | 'allowed' | 'blocked';

/** Consume RuntimeProvider's account/workspace-bound describe verdict. A local
 * runtime or a workspace listing cannot prove that remote plaintext APIs apply.
 */
export function useLegacyWorkspaceQueryStatus(
  workspaceId: string | null | undefined
): LegacyWorkspaceQueryStatus {
  const platform = usePlatform();
  const mode = useAtomValue(workspaceContentModeAtom);
  const runtime = useAtomValue(activeWorkspaceRuntimeAtom);
  const accountId = useAtomValue(userAtom)?.id ?? null;
  const currentWorkspaceId = useAtomValue(currentWorkspaceIdAtom);
  const currentWorkspaceSlug = useAtomValue(currentWorkspaceSlugAtom);
  const routeSlug = useWorkspaceRouteTargetSlug() ?? currentWorkspaceSlug;
  const workspacesState = usePlatformWorkspaces();
  if (platform.kind === 'local') return 'allowed';
  if (!workspaceId) return 'pending';
  if (
    (mode?.workspaceId === workspaceId &&
      mode.descriptor &&
      'contentMode' in mode.descriptor &&
      mode.descriptor.contentMode === 'e2ee') ||
    (runtime?.workspaceId === workspaceId && runtime.contentMode === 'e2ee') ||
    (workspacesState.status === 'ready' &&
      workspacesState.workspaces.some(
        (workspace) => workspace.id === workspaceId && workspace.contentMode === 'e2ee'
      ))
  )
    return 'blocked';
  if (
    !accountId ||
    !routeSlug ||
    currentWorkspaceId !== workspaceId ||
    mode?.accountId !== accountId ||
    mode.workspaceSlug !== routeSlug ||
    mode.workspaceId !== workspaceId ||
    mode.descriptor?.workspaceId !== workspaceId
  )
    return 'pending';
  const descriptor = mode.descriptor;
  return ('contentMode' in descriptor &&
    descriptor.contentMode === 'plaintext' &&
    descriptor.contentModeVersion === 1) ||
    ('admission' in descriptor && descriptor.admission === 'legacy-unclassified')
    ? 'allowed'
    : 'pending';
}

/** This UI/query decision never grants access to a machine or transport. */
export function useLegacyWorkspaceQueriesEnabled(workspaceId: string | null | undefined): boolean {
  return useLegacyWorkspaceQueryStatus(workspaceId) === 'allowed';
}
