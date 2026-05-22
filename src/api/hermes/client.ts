import {
  HermesChatCompletionRequest,
  HermesChatCompletionResponse,
  HermesConnection,
  HermesHealthResponse,
  HermesHealthDetailedResponse,
  HermesJob,
  HermesModel,
  HermesModelsResponse,
  HermesRun,
  HermesRunEvent,
} from './types';

export class HermesApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(connection: Pick<HermesConnection, 'baseUrl' | 'apiKey'>) {
    this.baseUrl = HermesApiClient.normalizeBaseUrl(connection.baseUrl);
    this.apiKey = connection.apiKey.trim();
  }

  static normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '');
  }

  async testConnection(): Promise<HermesHealthResponse> {
    try {
      return await this.get<HermesHealthResponse>('/health');
    } catch {
      return this.get<HermesHealthResponse>('/v1/health');
    }
  }

  async getHealthDetailed(): Promise<HermesHealthDetailedResponse> {
    const candidates = ['/health/detailed', '/v1/health/detailed', '/health', '/v1/health'];
    let lastError: unknown;
    for (const path of candidates) {
      try {
        return await this.get<HermesHealthDetailedResponse>(path);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Unable to fetch health details');
  }

  async listModels(): Promise<HermesModel[]> {
    const response = await this.get<HermesModelsResponse>('/v1/models');
    return response.data ?? [];
  }

  async chatCompletion(
    request: HermesChatCompletionRequest,
  ): Promise<HermesChatCompletionResponse> {
    return this.post<HermesChatCompletionResponse>('/v1/chat/completions', request);
  }

  async createRun(payload: unknown): Promise<HermesRun> {
    return this.post<HermesRun>('/v1/runs', payload);
  }

  async getRun(runId: string): Promise<HermesRun> {
    return this.get<HermesRun>(`/v1/runs/${encodeURIComponent(runId)}`);
  }

  async listRunEvents(runId: string): Promise<HermesRunEvent[]> {
    return this.get<HermesRunEvent[]>(`/v1/runs/${encodeURIComponent(runId)}/events`);
  }

  async listJobs(): Promise<HermesJob[]> {
    return this.get<HermesJob[]>('/api/jobs');
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }

    return text ? (JSON.parse(text) as T) : ({} as T);
  }
}
