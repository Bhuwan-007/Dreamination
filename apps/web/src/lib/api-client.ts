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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
}

export const apiClient = new DreamApiClient();
