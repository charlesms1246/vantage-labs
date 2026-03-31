const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_URL;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(error.message || "API request failed");
    }

    return response.json() as Promise<T>;
  }

  async health(): Promise<{ status: string }> {
    return this.request("/health");
  }

  async createSession(walletAddress: string): Promise<{ sessionId: string }> {
    return this.request("/api/session", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    });
  }

  async getSession(sessionId: string): Promise<{ sessionId: string; status: string }> {
    return this.request(`/api/session/${sessionId}`);
  }

  async getAgents(): Promise<{ agents: unknown[] }> {
    return this.request("/api/agents");
  }

  async getAgentStatus(agentName: string): Promise<{ name: string; verified: boolean; status: string }> {
    return this.request(`/api/agents/${agentName}/status`);
  }

  async getProof(cid: string): Promise<{ cid: string; data: unknown }> {
    return this.request(`/api/proofs/${cid}`);
  }

  async getSessionHistory(sessionId: string): Promise<unknown[]> {
    return this.request(`/api/session/${sessionId}/history`);
  }
}

export const api = new ApiClient();
