const PiApi = (() => {
  let lastAbort = null;
  let activeStreams = [];
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

  // Streaming search with progress callbacks
  // Uses its own AbortController so parallel calls don't cancel each other
  async function searchStream(digitQuery, pairAligned, onProgress) {
    const abort = new AbortController();
    // Track all active streams so cancel() can stop them all
    activeStreams.push(abort);

    const aligned = pairAligned ? '1' : '0';
    const url = `/api/pisearch?q=${encodeURIComponent(digitQuery)}&aligned=${aligned}&stream=1`;
    const resp = await fetch(url, { signal: abort.signal });
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      throw new Error(err || `API error: ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const msg = JSON.parse(line.slice(6));
          if (msg.type === 'progress' && onProgress) {
            onProgress(msg);
          } else if (msg.type === 'result') {
            finalResult = msg;
          }
        } catch {}
      }
    }

    // Remove this stream from active list
    activeStreams = activeStreams.filter(a => a !== abort);

    if (!finalResult) {
      const status = serverStatus || await checkStatus();
      return { found: false, results: [], count: 0, totalDigits: status?.totalDigits || 0, elapsed: 0 };
    }
    return finalResult;
  }

  function getStatus() {
    return serverStatus;
  }

  function cancel() {
    if (lastAbort) lastAbort.abort();
    activeStreams.forEach(a => a.abort());
    activeStreams = [];
  }

  return { search, searchStream, checkStatus, getStatus, cancel };
})();
