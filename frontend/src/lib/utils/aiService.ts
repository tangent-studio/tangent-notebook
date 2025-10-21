export interface AIProvider {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface AICompletionRequest {
  code: string;
  cursor: number;
  language: string;
  context?: string;
}

export interface AICompletionResponse {
  completions: string[];
  suggestions: string[];
}

export interface AIGenerationRequest {
  prompt: string;
  language: string;
  context?: string;
}

export interface AIGenerationResponse {
  code: string;
  explanation?: string;
}

export class AIService {
  private providers: Map<string, AIProvider> = new Map();
  private activeProvider: string | null = null;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize with default providers
    this.providers.set('github-copilot', {
      name: 'GitHub Copilot',
      baseUrl: 'https://api.github.com/copilot',
      model: 'copilot'
    });

    this.providers.set('claude', {
      name: 'Claude',
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-3-sonnet-20240229'
    });

    this.providers.set('ollama', {
      name: 'Ollama',
      baseUrl: 'http://localhost:11434/api',
      model: 'codellama'
    });
  }

  setProvider(providerId: string, config?: Partial<AIProvider>) {
    const provider = this.providers.get(providerId);
    if (provider) {
      if (config) {
        Object.assign(provider, config);
      }
      this.activeProvider = providerId;
    }
  }

  getActiveProvider(): AIProvider | null {
    if (!this.activeProvider) return null;
    return this.providers.get(this.activeProvider) || null;
  }

  async getCodeCompletion(request: AICompletionRequest): Promise<AICompletionResponse> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('No AI provider configured');
    }

    switch (this.activeProvider) {
      case 'github-copilot':
        return this.getGitHubCopilotCompletion(request, provider);
      case 'claude':
        return this.getClaudeCompletion(request, provider);
      case 'ollama':
        return this.getOllamaCompletion(request, provider);
      default:
        throw new Error(`Unsupported provider: ${this.activeProvider}`);
    }
  }

  async generateCode(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('No AI provider configured');
    }

    switch (this.activeProvider) {
      case 'claude':
        return this.generateWithClaude(request, provider);
      case 'ollama':
        return this.generateWithOllama(request, provider);
      default:
        throw new Error(`Code generation not supported for provider: ${this.activeProvider}`);
    }
  }

  private async getGitHubCopilotCompletion(
    request: AICompletionRequest,
    provider: AIProvider
  ): Promise<AICompletionResponse> {
    if (!provider.apiKey) {
      throw new Error('GitHub Copilot API key not configured');
    }

    try {
      const response = await fetch(`${provider.baseUrl}/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt: request.code,
          max_tokens: 100,
          temperature: 0.2,
          stop: ['\n\n']
        })
      });

      if (!response.ok) {
        throw new Error(`GitHub Copilot API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        completions: data.choices?.map((choice: any) => choice.text) || [],
        suggestions: []
      };
    } catch (error) {
      console.error('GitHub Copilot completion error:', error);
      return { completions: [], suggestions: [] };
    }
  }

  private async getClaudeCompletion(
    request: AICompletionRequest,
    provider: AIProvider
  ): Promise<AICompletionResponse> {
    if (!provider.apiKey) {
      throw new Error('Claude API key not configured');
    }

    try {
      const prompt = `Complete this JavaScript code:\n\n${request.code}\n\nProvide only the completion, no explanation:`;

      const response = await fetch(`${provider.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': provider.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 150,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json();
      const completion = data.content?.[0]?.text || '';
      
      return {
        completions: completion ? [completion] : [],
        suggestions: []
      };
    } catch (error) {
      console.error('Claude completion error:', error);
      return { completions: [], suggestions: [] };
    }
  }

  private async getOllamaCompletion(
    request: AICompletionRequest,
    provider: AIProvider
  ): Promise<AICompletionResponse> {
    try {
      const response = await fetch(`${provider.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: provider.model || 'codellama',
          prompt: `Complete this JavaScript code:\n${request.code}`,
          stream: false,
          options: {
            temperature: 0.2,
            top_p: 0.9,
            stop: ['\n\n']
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        completions: data.response ? [data.response] : [],
        suggestions: []
      };
    } catch (error) {
      console.error('Ollama completion error:', error);
      return { completions: [], suggestions: [] };
    }
  }

  private async generateWithClaude(
    request: AIGenerationRequest,
    provider: AIProvider
  ): Promise<AIGenerationResponse> {
    if (!provider.apiKey) {
      throw new Error('Claude API key not configured');
    }

    try {
      const prompt = `Generate JavaScript code for the following request:\n\n${request.prompt}\n\nProvide clean, well-commented code that can be executed in a notebook environment. Include any necessary explanations.`;

      const response = await fetch(`${provider.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': provider.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';
      
      // Try to extract code and explanation
      const codeMatch = content.match(/```(?:javascript|js)?\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content;
      
      return {
        code: code.trim(),
        explanation: content.includes('```') ? content.replace(/```(?:javascript|js)?\n[\s\S]*?\n```/, '').trim() : undefined
      };
    } catch (error) {
      console.error('Claude generation error:', error);
      throw error;
    }
  }

  private async generateWithOllama(
    request: AIGenerationRequest,
    provider: AIProvider
  ): Promise<AIGenerationResponse> {
    try {
      const response = await fetch(`${provider.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: provider.model || 'codellama',
          prompt: `Generate JavaScript code for: ${request.prompt}\n\nCode:`,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        code: data.response || '',
        explanation: undefined
      };
    } catch (error) {
      console.error('Ollama generation error:', error);
      throw error;
    }
  }

  // Utility methods
  isConfigured(): boolean {
    const provider = this.getActiveProvider();
    return provider !== null && (provider.apiKey !== undefined || this.activeProvider === 'ollama');
  }

  getAvailableProviders(): Array<{ id: string; name: string; configured: boolean }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      name: provider.name,
      configured: provider.apiKey !== undefined || id === 'ollama'
    }));
  }

  configureProvider(providerId: string, apiKey: string, options?: { baseUrl?: string; model?: string }) {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.apiKey = apiKey;
      if (options?.baseUrl) provider.baseUrl = options.baseUrl;
      if (options?.model) provider.model = options.model;
    }
  }
}

// Singleton instance
export const aiService = new AIService();