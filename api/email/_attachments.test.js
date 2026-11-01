import { describe, expect, it, vi } from 'vitest';
import { loadTempFiles, ownTempFiles, removeTempFiles } from './_attachments.js';

const fakeAdmin = (sizes = {}) => {
  const remove = vi.fn(async () => ({}));
  const download = vi.fn(async (path) => (path in sizes
    ? { data: { arrayBuffer: async () => new Uint8Array(sizes[path]).buffer } }
    : { error: new Error('saknas') }));
  return { remove, download, storage: { from: () => ({ download, remove }) } };
};

describe('ownTempFiles', () => {
  it('släpper bara igenom avsändarens egen tillfälliga mapp', () => {
    const files = ownTempFiles([
      { path: 'u1/mail-temp/a.pdf', filename: 'a.pdf' },
      { path: 'u2/mail-temp/b.pdf', filename: 'b.pdf' },
      { path: 'u1/kvitton/c.pdf', filename: 'c.pdf' },
      { path: 'u1/mail-temp/../kvitton/d.pdf', filename: 'd.pdf' },
    ], 'u1');
    expect(files.map(f => f.path)).toEqual(['u1/mail-temp/a.pdf']);
  });

  it('tvättar filnamnet och klarar saknad lista', () => {
    expect(ownTempFiles([{ path: 'u1/mail-temp/a.pdf', filename: 'a/b\nritning.pdf' }], 'u1')[0].filename).toBe('a b ritning.pdf');
    expect(ownTempFiles(undefined, 'u1')).toEqual([]);
  });
});

describe('loadTempFiles', () => {
  it('hämtar filen som base64', async () => {
    const admin = fakeAdmin({ 'u1/mail-temp/a.pdf': 3 });
    expect(await loadTempFiles(admin, [{ path: 'u1/mail-temp/a.pdf', filename: 'a.pdf' }])).toEqual([{ filename: 'a.pdf', content: 'AAAA' }]);
  });

  it('stoppar andra filtyper innan något hämtas', async () => {
    const admin = fakeAdmin({ 'u1/mail-temp/a.exe': 3 });
    await expect(loadTempFiles(admin, [{ path: 'u1/mail-temp/a.exe', filename: 'a.exe' }])).rejects.toThrow('Filformatet');
    expect(admin.download).not.toHaveBeenCalled();
  });

  it('stoppar för stora bilagor och filer som saknas', async () => {
    const admin = fakeAdmin({ 'u1/mail-temp/a.pdf': 16 * 1024 * 1024 });
    await expect(loadTempFiles(admin, [{ path: 'u1/mail-temp/a.pdf', filename: 'a.pdf' }])).rejects.toThrow('för stora');
    await expect(loadTempFiles(admin, [{ path: 'u1/mail-temp/x.pdf', filename: 'x.pdf' }])).rejects.toThrow('kunde inte läsas');
  });
});

describe('removeTempFiles', () => {
  it('raderar filerna och gör inget utan filer', async () => {
    const admin = fakeAdmin();
    await removeTempFiles(admin, []);
    expect(admin.remove).not.toHaveBeenCalled();
    await removeTempFiles(admin, [{ path: 'u1/mail-temp/a.pdf' }]);
    expect(admin.remove).toHaveBeenCalledWith(['u1/mail-temp/a.pdf']);
  });
});
