import { expose, wrap } from 'comlink';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportApi } from '../src/workers/exportApi';
import type { ExportWorkerApi } from '../src/workers/exportApi';
import { createExporter } from '../src/workers/exporter';
import { template, tightTurnProject } from './helpers';

describe('export worker', () => {
  const channels: MessageChannel[] = [];
  /** The worker API behind a real message channel, as the editor sees it. */
  function remote() {
    const channel = new MessageChannel();
    channels.push(channel);
    expose(exportApi, channel.port1);
    return wrap<ExportWorkerApi>(channel.port2);
  }
  afterEach(() => {
    for (const channel of channels.splice(0)) {
      channel.port1.close();
      channel.port2.close();
    }
  });

  it('sends the archive back through the channel', async () => {
    const result = await remote().run(template('club'), 'obj', 'en');
    expect(result).toMatchObject({ ok: true, filename: 'rb_test_club_obj.zip' });
    if (!result.ok) throw new Error('expected an archive');
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(new DataView(result.bytes.buffer, result.bytes.byteOffset).getUint32(0, true)).toBe(
      0x04034b50,
    );
  });

  it('reports a refused export as a value', async () => {
    const result = await remote().run(tightTurnProject(), 'assetto', 'fr');
    expect(result).toMatchObject({ ok: false, detail: { code: 'invalid-track' } });
  });
});

describe('exporter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('runs on the main thread when workers are unavailable', async () => {
    vi.stubGlobal('Worker', undefined);
    const result = await createExporter().run(template('kart'), 'assetto', 'fr');
    expect(result.ok).toBe(true);
  });

  it('starts one module worker on demand and stops it on dispose', () => {
    const terminate = vi.fn();
    const created: unknown[] = [];
    vi.stubGlobal(
      'Worker',
      class {
        constructor(...args: unknown[]) {
          created.push(args);
        }
        addEventListener() {}
        removeEventListener() {}
        postMessage() {}
        start() {}
        terminate = terminate;
      },
    );
    const exporter = createExporter();
    expect(created).toHaveLength(0);
    void exporter.run(template('kart'), 'assetto', 'fr');
    void exporter.run(template('kart'), 'obj', 'fr');
    expect(created).toHaveLength(1);
    expect(created[0]).toEqual([expect.any(URL), { type: 'module' }]);
    exporter.dispose();
    expect(terminate).toHaveBeenCalledOnce();
  });
});
