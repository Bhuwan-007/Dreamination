/**
 * Typed API Client for The Dream Machine Backend
 */

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  environment: string;
}

export interface UserResponse {
  id: string;
  email: string;
  settings: Record<string, any>;
  created_at: string;
}

export interface AuthResponse {
  user: UserResponse;
  access_token: string;
  token_type: string;
}

export interface DreamResponse {
  id: string;
  user_id: string;
  captured_at: string;
  raw_text: string | null;
  transcript: string | null;
  mood_on_waking: string | null;
  recent_life_context: string | null;
  raw_audio_key: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AudioUploadResponse {
  storage_key: string;
  raw_transcript: string;
  cleaned_transcript: string;
  duration_seconds: number;
}

export interface FollowupQuestion {
  id: string;
  text: string;
  targets: "emotion" | "sensation" | "character" | "transition" | "ending";
}

export interface FollowupResponse {
  questions: FollowupQuestion[];
}

export interface BeatItem {
  text: string;
  source: "user" | "inferred";
  inference_reason: string | null;
  confidence: number;
}

export interface DialogueItem {
  speaker: string;
  line: string;
  emotion: string;
  source: "user" | "inferred";
}

export interface ReconstructedScene {
  scene_id: number;
  heading: string;
  beats: BeatItem[];
  dialogue: DialogueItem[];
}

export interface ReconstructionOutput {
  title: string;
  mode: "faithful" | "authored";
  scenes: ReconstructedScene[];
}

export interface DreamVersionResponse {
  id: string;
  dream_id: string;
  mode: string;
  story: ReconstructionOutput;
  is_approved: boolean;
  created_at: string;
}

export interface ApproveDreamResponse {
  status: string;
  dream_id: string;
  version_id: string;
  message: string;
}

export interface ApiClientConfig {
  baseUrl?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

export class DreamApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("dream_auth_token");
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("dream_auth_token", token);
      } else {
        localStorage.removeItem("dream_auth_token");
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== "undefined") {
      this.token = localStorage.getItem("dream_auth_token");
    }
    return this.token;
  }

  async ensureAuthenticated(): Promise<string | null> {
    if (this.getToken()) {
      return this.getToken();
    }
    try {
      const res = await this.login("dreamer@local.dev", "DreamMaster123!");
      return res.access_token;
    } catch {
      try {
        const res = await this.signup("dreamer@local.dev", "DreamMaster123!");
        return res.access_token;
      } catch {
        return null;
      }
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!endpoint.startsWith("/auth") && !endpoint.startsWith("/health") && !this.getToken()) {
      await this.ensureAuthenticated();
    }

    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // send session cookie
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // Fallback for non-JSON errors
      }
      throw new ApiError(response.status, response.statusText, errorData);
    }

    return response.json();
  }

  // --- Health ---
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  // --- Auth ---
  async signup(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request<{ message: string }>("/auth/logout", { method: "POST" });
    } finally {
      this.setToken(null);
    }
  }

  async getMe(): Promise<UserResponse> {
    return this.request<UserResponse>("/auth/me");
  }

  // --- Dreams ---
  async uploadAudio(audioBlob: Blob, filename = "dream.webm"): Promise<AudioUploadResponse> {
    const formData = new FormData();
    formData.append("file", audioBlob, filename);

    return this.request<AudioUploadResponse>("/dreams/upload-audio", {
      method: "POST",
      body: formData,
    });
  }

  async createDream(data: {
    raw_text?: string;
    transcript?: string;
    mood_on_waking?: string;
    recent_life_context?: string;
    raw_audio_key?: string;
  }): Promise<DreamResponse> {
    return this.request<DreamResponse>("/dreams", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async listDreams(): Promise<Array<{ id: string; captured_at: string; mood_on_waking: string | null; status: string }>> {
    return this.request("/dreams");
  }

  async getDream(dreamId: string): Promise<DreamResponse> {
    return this.request<DreamResponse>(`/dreams/${dreamId}`);
  }

  async deleteDream(dreamId: string): Promise<void> {
    await this.request<void>(`/dreams/${dreamId}`, { method: "DELETE" });
  }

  async getFollowupQuestions(dreamId: string): Promise<FollowupResponse> {
    return this.request<FollowupResponse>(`/dreams/${dreamId}/followups`, {
      method: "POST",
    });
  }

  async submitFollowupAnswers(
    dreamId: string,
    answers: Array<{ question_id: string; question_text: string; answer: string }>
  ): Promise<DreamResponse> {
    return this.request<DreamResponse>(`/dreams/${dreamId}/answers`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  }

  // --- Reconstruction & Review (Phase 5) ---
  async reconstructDream(
    dreamId: string,
    mode: "faithful" | "authored" = "faithful",
    forceRebuild = false
  ): Promise<DreamVersionResponse> {
    return this.request<DreamVersionResponse>(`/dreams/${dreamId}/reconstruct`, {
      method: "POST",
      body: JSON.stringify({ mode, force_rebuild: forceRebuild }),
    });
  }

  async listDreamVersions(dreamId: string): Promise<DreamVersionResponse[]> {
    return this.request<DreamVersionResponse[]>(`/dreams/${dreamId}/versions`);
  }

  async repairScene(
    dreamId: string,
    sceneId: number,
    correction: string
  ): Promise<{ version_id: string; scene: ReconstructedScene }> {
    return this.request<{ version_id: string; scene: ReconstructedScene }>(
      `/dreams/${dreamId}/scenes/${sceneId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ correction }),
      }
    );
  }

  async approveDream(
    dreamId: string,
    versionId?: string
  ): Promise<ApproveDreamResponse> {
    return this.request<ApproveDreamResponse>(`/dreams/${dreamId}/approve`, {
      method: "POST",
      body: JSON.stringify({ version_id: versionId }),
    });
  }

  // --- Interpretation & Reflection (Phase 6) ---
  async getInterpretation(dreamId: string): Promise<InterpretationResponse | null> {
    return this.request<InterpretationResponse | null>(`/dreams/${dreamId}/interpret`);
  }

  async generateInterpretation(dreamId: string): Promise<InterpretationResponse> {
    return this.request<InterpretationResponse>(`/dreams/${dreamId}/interpret`, {
      method: "POST",
    });
  }

  async submitInterpretationFeedback(
    dreamId: string,
    payload: {
      selected_thread_index?: number | null;
      feedback: "resonates" | "felt_different" | "none";
      feedback_note?: string | null;
    }
  ): Promise<InterpretationResponse> {
    return this.request<InterpretationResponse>(`/dreams/${dreamId}/interpret/feedback`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

export interface EvidenceItem {
  quote_from_user: string;
  why_it_matters: string;
}

export interface InterpretedSymbol {
  name: string;
  possible_meaning: string;
}

export interface InterpretationThread {
  lens: string;
  title: string;
  reading: string;
  evidence: EvidenceItem[];
  waking_life_questions: string[];
  symbols: InterpretedSymbol[];
}

export interface InterpretationResponse {
  id: string;
  dream_id: string;
  threads: InterpretationThread[];
  selected_thread_index?: number | null;
  feedback: "resonates" | "felt_different" | "none";
  feedback_note?: string | null;
  created_at: string;
}

export const apiClient = new DreamApiClient();
