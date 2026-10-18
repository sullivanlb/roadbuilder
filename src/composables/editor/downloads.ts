type Timer = ReturnType<typeof setTimeout>;

/** Creates object URLs for downloads and revokes them after 30 s or on dispose. */
export function createDownloads() {
  const urls = new Map<string, Timer>();
  function download(data: string | Uint8Array, filename: string, type: string) {
    const content = typeof data === 'string' ? data : new Uint8Array(data);
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    urls.set(
      url,
      setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.delete(url);
      }, 30000),
    );
  }
  function dispose() {
    for (const [url, timer] of urls) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    urls.clear();
  }
  return { download, dispose };
}
