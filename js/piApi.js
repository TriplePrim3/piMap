const PiApi = (() => {
  let lastAbort = null;
  let serverStatus = null;

  async function checkStatus() {
    try {
      const resp = await fetch('/api/pistatus');
      serverStatus = await resp.json();
      return serverStatus;
    } catch {
      serverStatus = null;
      return null;
    }
  }

  async function search(digitQuery, pairAligned) {
    if (lastAbort) lastAbort.abort();
    lastAbort = new AbortController();

    const aligned = pairAligned ? '1' : '0';
    const url = `/api/pisearch?q=${encodeURIComponent(digitQuery)}&aligned=${aligned}`;
    const resp = await fetch(url, { signal: lastAbort.signal });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${resp.status}`);
    }
    return await resp.json();
  }

  function getStatus() {
    return serverStatus;
  }

  function cancel() {
    if (lastAbort) lastAbort.abort();
  }

  return { search, checkStatus, getStatus, cancel };
})();
