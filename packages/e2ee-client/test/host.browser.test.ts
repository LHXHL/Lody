type HostGlobal = typeof globalThis & {
  HostFixture: typeof import('./browser/host-fixture');
  restorePut: () => void;
};
import { build } from 'esbuild';
import { chromium, webkit, type BrowserContext, type Page } from '@playwright/test';
import { it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const call = (p: Page, a: string) =>
  p.evaluate((action) => (globalThis as HostGlobal).HostFixture.invoke(action), a);
const record = (result: Awaited<ReturnType<typeof call>>) => {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (
    !result.ok ||
    !result.value ||
    typeof result.value !== 'object' ||
    Array.isArray(result.value)
  )
    throw new Error('fixture record expected');
  return result.value as Record<string, unknown>;
};
it.each(['chromium', 'webkit'] as const)(
  'portable personal host uses genuine custody, stores, approval and mailbox in %s',
  async (engine) => {
    const dir = await mkdtemp(join(tmpdir(), 'lody-personal-host-'));
    let context: BrowserContext | undefined;
    try {
      const output = await build({
        entryPoints: [fileURLToPath(new URL('./browser/host-fixture.ts', import.meta.url))],
        platform: 'browser',
        bundle: true,
        format: 'iife',
        globalName: 'HostFixture',
        target: 'safari16.4',
        write: false,
        metafile: true,
        logLevel: 'silent',
      });
      expect(Object.values(output.metafile!.outputs).flatMap((o) => o.imports)).toEqual([]);
      expect(
        Object.keys(output.metafile!.inputs).some((s) =>
          /(?:node-sqlite|e2ee-node|electron)/.test(s)
        )
      ).toBe(false);
      const file = join(dir, 'index.html');
      await writeFile(
        file,
        '<!doctype html><script>' +
          output.outputFiles[0].text.replaceAll('</script', '<\\/script') +
          '</script>'
      );
      const browser = engine === 'chromium' ? chromium : webkit;
      context = await browser.launchPersistentContext(join(dir, 'profile'), { headless: true });
      let page = await context.newPage();
      await page.goto(pathToFileURL(file).href);
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.boot());
      const prepared = await call(page, 'prepare');
      expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
      expect(await call(page, 'prepare')).toEqual(prepared);
      expect((await call(page, 'wrongOffer')).ok).toBe(false);
      expect((await call(page, 'open')).reason).toBe('approval-required');
      expect((await call(page, 'events')).value).toEqual([]);
      expect((await call(page, 'begin')).value).toEqual({ status: 'pending' });
      expect((await call(page, 'foreignClaim')).reason).toBe('scope-mismatch');
      expect((await call(page, 'open')).reason).toBe('approval-required');
      expect((await call(page, 'approve')).ok).toBe(true);
      expect(await call(page, 'claim')).toEqual({ ok: true, value: { status: 'approved' } });
      expect(await call(page, 'claim')).toEqual({ ok: true, value: { status: 'approved' } });
      expect((await call(page, 'open')).ok).toBe(true);
      expect(record(await call(page, 'ledger')).length).toBe(2);
      expect((await call(page, 'keyFailure')).ok).toBe(false);
      expect((await call(page, 'ledger')).ok).toBe(true);
      expect((await call(page, 'keyRound')).ok).toBe(true);
      const sealed = await call(page, 'seal');
      expect(sealed.ok, JSON.stringify(sealed)).toBe(true);
      expect((await call(page, 'openBody')).value).toEqual([72, 105]);
      expect((await call(page, 'events')).value).toContain('installation-report');
      expect(record(await call(page, 'receipt')).recipient).toBe(record(prepared).signingPublicKey);
      expect((await call(page, 'addMachine')).ok).toBe(true);
      expect((await call(page, 'refresh')).ok).toBe(true);
      const rpc = await call(page, 'rpc');
      expect(rpc.ok, JSON.stringify(rpc)).toBe(true);
      expect(await call(page, 'rpc')).toEqual(rpc);
      expect((await call(page, 'rpcChanged')).ok).toBe(false);
      expect(await call(page, 'rpc')).toEqual(rpc);
      expect((await call(page, 'poisonSubmission')).ok).toBe(true);
      expect((await call(page, 'resumeForeign')).reason).toBe('conflict');
      expect(record(await call(page, 'ledger')).length).toBe(3);
      expect((await call(page, 'candidate')).ok).toBe(true);
      expect((await call(page, 'secondCandidate')).reason).toBe('conflict');
      expect((await call(page, 'ledger')).ok).toBe(true);
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.stop());
      await context.close();
      context = await browser.launchPersistentContext(join(dir, 'profile'), { headless: true });
      page = await context.newPage();
      await page.goto(pathToFileURL(file).href);
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.boot('open-existing'));
      expect(await call(page, 'prepare')).toEqual(prepared);
      expect((await call(page, 'open')).ok).toBe(true);
      expect((await call(page, 'openBody')).value).toEqual([72, 105]);
      expect(await call(page, 'rpc')).toEqual(rpc);
      expect((await call(page, 'rotateRemote')).ok).toBe(true);
      expect((await call(page, 'refresh')).ok).toBe(true);
      expect((await call(page, 'status')).value).toEqual({
        currentEpoch: 1,
        usableEpoch: 0,
        rotationRequired: false,
      });
      expect((await call(page, 'seal')).ok).toBe(true);
      expect((await call(page, 'stagingUnavailable')).ok).toBe(true);
      expect((await call(page, 'keyRound')).ok).toBe(true);
      expect(record(await call(page, 'status')).usableEpoch).toBe(0);
      expect((await call(page, 'ledger')).ok).toBe(true);
      // A stored group is not authority, even when its locator matched the committed epoch.
      expect((await call(page, 'stageCurrent')).ok).toBe(true);
      expect((await call(page, 'corruptStaged')).ok).toBe(true);
      expect((await call(page, 'keyRound')).ok).toBe(false);
      expect(record(await call(page, 'status')).usableEpoch).toBe(0);
      expect((await call(page, 'seal')).ok).toBe(true);
      // The publisher can disappear after staging + ledger commit, before mailbox delivery.
      expect((await call(page, 'stageCurrent')).ok).toBe(true);
      expect((await call(page, 'keyRound')).ok).toBe(true);
      expect((await call(page, 'status')).value).toEqual({
        currentEpoch: 1,
        usableEpoch: 1,
        rotationRequired: false,
      });
      expect((await call(page, 'seal')).ok).toBe(true);
      expect((await call(page, 'openBody')).value).toEqual([72, 105]);
      expect((await call(page, 'revoke')).ok).toBe(true);
      expect((await call(page, 'refresh')).ok).toBe(true);
      expect(record(await call(page, 'ledger')).length).toBe(5);
      expect((await call(page, 'seal')).ok).toBe(false);
      expect((await call(page, 'rpc')).ok).toBe(false);
      const events = (await call(page, 'events')).value;
      expect((await call(page, 'keyRound')).ok).toBe(false);
      expect((await call(page, 'events')).value).toEqual(events);
      expect((await call(page, 'corruptInstallation')).ok).toBe(true);
      expect((await call(page, 'prepare')).reason).toBe('corrupt');
      expect((await call(page, 'requestOriginal')).value).toBe(record(prepared).requestHex);
      expect((await call(page, 'close')).ok).toBe(true);
      expect((await call(page, 'ledger')).reason).toBe('closed');
      expect((await call(page, 'prepare')).reason).toBe('closed');
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.stop());
    } finally {
      await context?.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
);

it.each(['chromium', 'webkit'] as const)(
  'unknown relay results and close retain exact identity and claim in %s',
  async (engine) => {
    const dir = await mkdtemp(join(tmpdir(), 'lody-personal-close-'));
    let context: BrowserContext | undefined;
    try {
      const output = await build({
        entryPoints: [fileURLToPath(new URL('./browser/host-fixture.ts', import.meta.url))],
        platform: 'browser',
        bundle: true,
        format: 'iife',
        globalName: 'HostFixture',
        target: 'safari16.4',
        write: false,
        logLevel: 'silent',
      });
      const file = join(dir, 'index.html');
      await writeFile(
        file,
        '<!doctype html><script>' +
          output.outputFiles[0].text.replaceAll('</script', '<\\/script') +
          '</script>'
      );
      const browser = engine === 'chromium' ? chromium : webkit;
      context = await browser.launchPersistentContext(join(dir, 'profile'), { headless: true });
      let page = await context.newPage();
      await page.goto(pathToFileURL(file).href);
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.boot());
      await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        let injected = false;
        IDBObjectStore.prototype.put = function (...args) {
          if (
            this.name === 'pairing' &&
            (args[0] as Record<string, unknown>).purpose === 'request' &&
            (args[0] as Record<string, unknown>).receipt &&
            !injected
          ) {
            injected = true;
            throw new DOMException(
              'synthetic quota after actual identity wrapping',
              'QuotaExceededError'
            );
          }
          return Reflect.apply(put, this, args);
        };
        (globalThis as HostGlobal).restorePut = () => {
          IDBObjectStore.prototype.put = put;
        };
      });
      try {
        expect((await call(page, 'prepare')).reason).toBe('capacity');
      } finally {
        await page.evaluate(() => (globalThis as HostGlobal).restorePut());
      }
      const original = (await call(page, 'requestOriginal')).value;
      const prepared = await call(page, 'prepare');
      expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
      expect(record(prepared).requestHex).toBe(original);
      expect((await call(page, 'lostBegin')).ok).toBe(false);
      expect(await call(page, 'prepare')).toEqual(prepared);
      expect((await call(page, 'begin')).value).toEqual({ status: 'pending' });
      expect((await call(page, 'startHeld')).ok).toBe(true);
      expect((await call(page, 'close')).ok).toBe(true);
      expect((await call(page, 'heldOutcome')).value).toBe(true);
      expect((await call(page, 'events')).value).toEqual(['network-aborted']);
      expect((await call(page, 'prepare')).reason).toBe('closed');
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.stop());
      await context.close();
      context = await browser.launchPersistentContext(join(dir, 'profile'), { headless: true });
      page = await context.newPage();
      await page.goto(pathToFileURL(file).href);
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.boot('open-existing'));
      expect(await call(page, 'prepare')).toEqual(prepared);
      expect((await call(page, 'begin')).value).toEqual({ status: 'pending' });
      expect((await call(page, 'open')).reason).toBe('approval-required');
      expect((await call(page, 'retryOffer')).reason).toBe('conflict');
      expect((await call(page, 'cancel')).value).toEqual({ status: 'cancelled' });
      const retry = await call(page, 'retryOffer');
      expect(retry.ok, JSON.stringify(retry)).toBe(true);
      expect(record(retry).signingPublicKey).toBe(record(prepared).signingPublicKey);
      expect(record(retry).requestHex).not.toBe(record(prepared).requestHex);
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.stop());
    } finally {
      await context?.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
);

it.each(['chromium', 'webkit'] as const)(
  'new desktop approval atomically replaces the local identity and preserves the ledger origin in %s',
  async (engine) => {
    const dir = await mkdtemp(join(tmpdir(), 'lody-personal-replace-'));
    let context: BrowserContext | undefined;
    try {
      const output = await build({
        entryPoints: [fileURLToPath(new URL('./browser/host-fixture.ts', import.meta.url))],
        platform: 'browser',
        bundle: true,
        format: 'iife',
        globalName: 'HostFixture',
        target: 'safari16.4',
        write: false,
        logLevel: 'silent',
      });
      const file = join(dir, 'index.html');
      await writeFile(
        file,
        '<!doctype html><script>' +
          output.outputFiles[0].text.replaceAll('</script', '<\\/script') +
          '</script>'
      );
      const browser = engine === 'chromium' ? chromium : webkit;
      context = await browser.launchPersistentContext(join(dir, 'profile'), { headless: true });
      let page = await context.newPage();
      await page.goto(pathToFileURL(file).href);
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.boot());
      const first = await call(page, 'prepare');
      expect((await call(page, 'approve')).ok).toBe(true);
      expect((await call(page, 'claim')).ok).toBe(true);
      expect((await call(page, 'open')).ok).toBe(true);
      const candidate = await call(page, 'candidate');
      expect(candidate.ok).toBe(true);
      expect(record(candidate).signingPublicKey).not.toBe(record(first).signingPublicKey);
      expect((await call(page, 'openCandidate')).reason).toBe('approval-required');
      expect((await call(page, 'ledger')).ok).toBe(true);
      expect((await call(page, 'approveCandidate')).ok).toBe(true);
      expect((await call(page, 'claimCandidate')).value).toEqual({ status: 'approved' });
      expect((await call(page, 'candidateControlFailure')).ok).toBe(false);
      expect((await call(page, 'ledger')).ok).toBe(true);
      const opened = await call(page, 'openCandidate');
      expect(opened.ok, JSON.stringify(opened)).toBe(true);
      expect((await call(page, 'oldOwner')).reason).toBe('closed');
      expect(record(await call(page, 'ledger')).length).toBe(3);
      expect((await call(page, 'keyRound')).ok).toBe(true);
      expect((await call(page, 'seal')).ok).toBe(true);
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.stop());
      await context.close();
      context = await browser.launchPersistentContext(join(dir, 'profile'), { headless: true });
      page = await context.newPage();
      await page.goto(pathToFileURL(file).href);
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.boot('open-existing'));
      expect(await call(page, 'candidate')).toEqual(candidate);
      expect((await call(page, 'openCandidate')).ok).toBe(true);
      expect((await call(page, 'openBody')).value).toEqual([72, 105]);
      expect((await call(page, 'prepare')).reason).toBe('conflict');
      await page.evaluate(() => (globalThis as HostGlobal).HostFixture.stop());
    } finally {
      await context?.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
);
