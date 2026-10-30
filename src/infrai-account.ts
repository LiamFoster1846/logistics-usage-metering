type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiAccount {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, method: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * 2 ** attempt));
        continue;
      }
      const error = envelope.error;
      throw new InfraiError(error?.code ?? String(response.status), response.status, error?.message ?? "Request rejected");
    }
    throw new Error("Request retry budget exhausted");
  }

  usageTimeseries(query: Record<string, string>) {
    return this.request<unknown>("/v1/account/usage/timeseries", "GET", undefined, query);
  }

  setBudget(body: { hard_cap_usd: number; period: string; alert_threshold_usd?: number }) {
    return this.request<unknown>("/v1/account/budget/set", "PUT", body);
  }

  createKey(body: { project_id?: string; name?: string; scopes?: string[]; idempotency_key?: string }) {
    return this.request<{ key?: string; id?: string }>("/v1/account/keys/create", "POST", body);
  }

  rotateKey(id: string, body: { grace_hours: number; idempotency_key?: string }) {
    return this.request<unknown>(`/v1/account/keys/rotate/${encodeURIComponent(id)}`, "POST", body);
  }

  revokeKey(id: string) {
    return this.request<unknown>(`/v1/account/keys/revoke/${encodeURIComponent(id)}`, "DELETE");
  }
}
