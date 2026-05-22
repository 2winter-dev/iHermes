export type HermesRole = 'system' | 'user' | 'assistant' | 'tool';

export interface HermesConnection {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
  apiModelName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HermesHealthResponse {
  status: 'ok' | string;
}

export interface HermesHealthDetailedResponse {
  status?: string;
  version?: string;
  hermes_version?: string;
  app_version?: string;
  [key: string]: unknown;
}

export interface HermesModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface HermesModelsResponse {
  object?: string;
  data: HermesModel[];
}

export interface HermesChatMessage {
  role: HermesRole;
  content: string;
}

export interface HermesChatCompletionRequest {
  model: string;
  messages: HermesChatMessage[];
  stream?: boolean;
  temperature?: number;
}

export interface HermesChatChoice {
  index: number;
  message: HermesChatMessage;
  finish_reason?: string | null;
}

export interface HermesChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface HermesChatCompletionResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: HermesChatChoice[];
  usage?: HermesChatUsage;
}

export interface HermesRun {
  id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface HermesRunEvent {
  id?: string;
  type: string;
  created_at?: string;
  data?: unknown;
}

export interface HermesJob {
  id: string;
  name?: string;
  status?: string;
  schedule?: string;
}
