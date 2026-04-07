// Agent SSE worker - runs outside React to avoid render interference
// Called via window.postMessage from the playground

self.addEventListener("message", async (e) => {
  const { id, url, key, body } = e.data;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    self.postMessage({ id, type: "status", status: res.status });

    if (!res.ok || !res.body) {
      const text = await res.text();
      self.postMessage({ id, type: "error", message: text });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        const t = line.trim();
        if (!t || t.startsWith(":")) continue;
        if (t.startsWith("event: ")) { currentEvent = t.slice(7); continue; }
        if (!t.startsWith("data: ") || t === "data: [DONE]") continue;

        try {
          const json = JSON.parse(t.slice(6));
          self.postMessage({ id, type: "event", event: currentEvent, data: json });
          if (currentEvent === "turn_complete") {
            reader.cancel();
            self.postMessage({ id, type: "done" });
            return;
          }
        } catch {}
        currentEvent = "";
      }
    }
    self.postMessage({ id, type: "done" });
  } catch (err) {
    self.postMessage({ id, type: "error", message: err.message });
  }
});
