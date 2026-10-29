// @vitest-environment jsdom
import { ErrorBoundary } from '../src/components/error-boundary';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'jotai';
import { getMachineRoomId, type MachineId } from '@lody/shared';
import { createStaticStore, type CloudApi, type PlatformProvider } from '@lody/platform';
import { PlatformContext } from '@lody/platform/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useVisibleMachineMetas } from '../src/hooks/use-visible-machine-metas';
import { useVisibleLocalProjectsFromMachineIndex } from '../src/hooks/use-visible-local-projects';
import { AuthenticatedConvexContext } from '../src/hooks/use-authenticated-convex';
import { runtimeAtom } from '../src/atoms/runtime';
import { workspaceContentModeAtom } from '../src/atoms/workspace-content-mode';
import { machineMetaCacheAtom } from '../src/atoms/doc-meta';
import {
  createTourStore,
  DEFAULT_TOUR_IDENTITY,
  TOUR_USER_ID,
  TOUR_WORKSPACE_ID,
  TOUR_WORKSPACE_SLUG,
} from '../src/components/onboarding/tour/tour-fixtures';
import { TEST_CLOUD_PLATFORM } from './test-platform';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function VisibleResources() {
  const machines = useVisibleMachineMetas({ includeMachineFlock: false });
  const projects = useVisibleLocalProjectsFromMachineIndex(machines);
  return (
    <output>
      {JSON.stringify({
        machines: [...machines.machines.keys()],
        projects: [...projects.projects.values()].map((p) => p.project.name),
        loading: machines.isLoading || projects.isLoading,
      })}
    </output>
  );
}

it.each(['unpaired', 'paired'] as const)(
  'keeps %s encrypted visibility local and never queries legacy access',
  async (pairing) => {
    const store = createTourStore(DEFAULT_TOUR_IDENTITY);
    const runtime = store.get(runtimeAtom)!;
    store.set(machineMetaCacheAtom, (current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, machine]) => [
          key,
          { ...machine, ownerUserId: TOUR_USER_ID },
        ])
      )
    );
    store.set(
      runtimeAtom,
      pairing === 'paired' ? { ...runtime, accountId: TOUR_USER_ID, contentMode: 'e2ee' } : null
    );
    store.set(workspaceContentModeAtom, {
      accountId: TOUR_USER_ID,
      workspaceSlug: TOUR_WORKSPACE_SLUG,
      workspaceId: TOUR_WORKSPACE_ID,
      descriptor: {
        workspaceId: TOUR_WORKSPACE_ID,
        contentMode: 'e2ee',
        activation: 'control-only',
        contentModeVersion: 1,
        cryptoOrgId: 'ab'.repeat(32),
        genesisHash: 'ab'.repeat(32),
      },
    });
    const query: CloudApi['useQuery'] = (_operation, args) => {
      if (args !== 'skip')
        throw Object.assign(new Error('e2ee_control_only'), {
          data: { code: 'e2ee_control_only' },
        });
      return undefined;
    };
    const platform: PlatformProvider = {
      ...TEST_CLOUD_PLATFORM,
      cloudApi: { ...TEST_CLOUD_PLATFORM.cloudApi!, useQuery: query },
      identity: {
        ...TEST_CLOUD_PLATFORM.identity,
        session: createStaticStore({ status: 'authenticated', user: { id: TOUR_USER_ID } }),
      },
    };
    await act(async () =>
      root.render(
        <PlatformContext.Provider value={platform}>
          <Provider store={store}>
            <AuthenticatedConvexContext.Provider
              value={{ isAuthenticated: true, isLoading: false } as never}
            >
              <VisibleResources />
            </AuthenticatedConvexContext.Provider>
          </Provider>
        </PlatformContext.Provider>
      )
    );
    const snapshot = JSON.parse(container.querySelector('output')!.textContent!);
    expect(snapshot.loading).toBe(false);
    expect(snapshot.machines).toHaveLength(1);
    expect(snapshot.projects).toHaveLength(1);
    // A teammate's metadata in the protected workspace is not a sharing grant.
    await act(async () =>
      store.set(
        machineMetaCacheAtom,
        (current) =>
          ({
            ...current,
            [getMachineRoomId('foreign' as MachineId)]: {
              ...Object.values(current)[0],
              id: 'foreign',
              ownerUserId: 'another-user',
            },
          }) as never
      )
    );
    expect(JSON.parse(container.querySelector('output')!.textContent!).machines).toEqual(
      snapshot.machines
    );
  }
);

it('preserves ordinary visibility failures instead of swallowing an unrelated backend error', async () => {
  const store = createTourStore(DEFAULT_TOUR_IDENTITY);
  const platform = {
    ...TEST_CLOUD_PLATFORM,
    cloudApi: {
      ...TEST_CLOUD_PLATFORM.cloudApi!,
      useQuery: (_operation: unknown, args: unknown) => {
        if (args !== 'skip') throw new Error('ordinary access failure');
        return undefined;
      },
    },
  };
  await act(async () =>
    root.render(
      <PlatformContext.Provider value={platform}>
        <Provider store={store}>
          <AuthenticatedConvexContext.Provider
            value={{ isAuthenticated: true, isLoading: false } as never}
          >
            <ErrorBoundary
              fallbackRender={({ error }) => <output role="alert">{String(error)}</output>}
            >
              <VisibleResources />
            </ErrorBoundary>
          </AuthenticatedConvexContext.Provider>
        </Provider>
      </PlatformContext.Provider>
    )
  );
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    'ordinary access failure'
  );
});

it('still renders registered ordinary machines and projects from the cloud visibility rows', async () => {
  const store = createTourStore(DEFAULT_TOUR_IDENTITY);
  const machine = Object.values(store.get(machineMetaCacheAtom))[0]!;
  const rows = [
    { machineId: machine.id, ownerUserId: TOUR_USER_ID, sharedWithTeam: false, updatedAt: 1 },
  ];
  const useQuery: CloudApi['useQuery'] = (operation, args) => {
    if (args === 'skip') return undefined;
    return (
      operation.name === 'machines:listVisibleMachines'
        ? rows
        : Object.keys(machine.localProjects!).map((localProjectId) => ({
            ...rows[0],
            localProjectId,
          }))
    ) as never;
  };
  const platform: PlatformProvider = {
    ...TEST_CLOUD_PLATFORM,
    cloudApi: { ...TEST_CLOUD_PLATFORM.cloudApi!, useQuery },
  };
  await act(async () =>
    root.render(
      <PlatformContext.Provider value={platform}>
        <Provider store={store}>
          <AuthenticatedConvexContext.Provider
            value={{ isAuthenticated: true, isLoading: false } as never}
          >
            <VisibleResources />
          </AuthenticatedConvexContext.Provider>
        </Provider>
      </PlatformContext.Provider>
    )
  );
  const snapshot = JSON.parse(container.querySelector('output')!.textContent!);
  expect(snapshot).toEqual({
    machines: [machine.id],
    projects: [DEFAULT_TOUR_IDENTITY.projectName],
    loading: false,
  });
});
