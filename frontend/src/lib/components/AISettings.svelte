<script lang="ts">
  import { aiService } from '../utils/aiService';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let showSettings = false;
  let activeProvider = '';
  let providers = aiService.getAvailableProviders();
  let apiKeys: Record<string, string> = {};
  let customUrls: Record<string, string> = {};
  let models: Record<string, string> = {};

  // Load saved settings from localStorage
  function loadSettings() {
    const saved = localStorage.getItem('ai-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      apiKeys = settings.apiKeys || {};
      customUrls = settings.customUrls || {};
      models = settings.models || {};
      activeProvider = settings.activeProvider || '';
      
      // Configure providers
      Object.entries(apiKeys).forEach(([providerId, apiKey]) => {
        if (apiKey) {
          aiService.configureProvider(providerId, apiKey, {
            baseUrl: customUrls[providerId],
            model: models[providerId]
          });
        }
      });
      
      if (activeProvider) {
        aiService.setProvider(activeProvider);
      }
    }
  }

  function saveSettings() {
    const settings = {
      activeProvider,
      apiKeys,
      customUrls,
      models
    };
    localStorage.setItem('ai-settings', JSON.stringify(settings));
    
    // Configure the active provider
    if (activeProvider && apiKeys[activeProvider]) {
      aiService.configureProvider(activeProvider, apiKeys[activeProvider], {
        baseUrl: customUrls[activeProvider],
        model: models[activeProvider]
      });
      aiService.setProvider(activeProvider);
    }
    
    dispatch('settingsChanged');
  }

  function testConnection(providerId: string) {
    // Simple test - just check if we can configure the provider
    try {
      if (apiKeys[providerId] || providerId === 'ollama') {
        aiService.configureProvider(providerId, apiKeys[providerId] || '', {
          baseUrl: customUrls[providerId],
          model: models[providerId]
        });
        alert(`${providers.find(p => p.id === providerId)?.name} configured successfully!`);
      } else {
        alert('Please enter an API key first.');
      }
    } catch (error) {
      alert(`Configuration failed: ${error.message}`);
    }
  }

  // Initialize
  loadSettings();
</script>

<div class="ai-settings">
  <button 
    class="settings-toggle"
    on:click={() => showSettings = !showSettings}
    title="AI Settings"
  >
    🤖 AI
  </button>

  {#if showSettings}
    <div class="settings-modal">
      <div class="settings-content">
        <div class="settings-header">
          <h3>AI Code Completion Settings</h3>
          <button class="close-btn" on:click={() => showSettings = false}>×</button>
        </div>

        <div class="settings-body">
          <div class="provider-selection">
            <label for="ai-provider-select">Active Provider:</label>
            <select id="ai-provider-select" bind:value={activeProvider} on:change={saveSettings}>
              <option value="">None</option>
              {#each providers as provider}
                <option value={provider.id}>{provider.name}</option>
              {/each}
            </select>
          </div>

          {#each providers as provider}
            <div class="provider-config" class:active={activeProvider === provider.id}>
              <h4>{provider.name}</h4>
              
              {#if provider.id !== 'ollama'}
                <div class="form-group">
                  <label for="{provider.id}-api-key">API Key:</label>
                  <input
                    id="{provider.id}-api-key"
                    type="password"
                    bind:value={apiKeys[provider.id]}
                    placeholder="Enter your API key"
                    on:blur={saveSettings}
                  />
                </div>
              {/if}

              <div class="form-group">
                <label for="{provider.id}-url">Base URL:</label>
                <input
                  id="{provider.id}-url"
                  type="url"
                  bind:value={customUrls[provider.id]}
                  placeholder={provider.id === 'ollama' ? 'http://localhost:11434/api' : 'Default URL'}
                  on:blur={saveSettings}
                />
              </div>

              <div class="form-group">
                <label for="{provider.id}-model">Model:</label>
                <input
                  id="{provider.id}-model"
                  type="text"
                  bind:value={models[provider.id]}
                  placeholder={
                    provider.id === 'claude' ? 'claude-3-sonnet-20240229' :
                    provider.id === 'ollama' ? 'codellama' :
                    'Default model'
                  }
                  on:blur={saveSettings}
                />
              </div>

              <button 
                class="test-btn"
                on:click={() => testConnection(provider.id)}
                disabled={provider.id !== 'ollama' && !apiKeys[provider.id]}
              >
                Test Connection
              </button>

              {#if provider.id === 'github-copilot'}
                <p class="provider-note">
                  Note: GitHub Copilot requires a valid subscription and API access.
                </p>
              {:else if provider.id === 'claude'}
                <p class="provider-note">
                  Get your API key from <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a>
                </p>
              {:else if provider.id === 'ollama'}
                <p class="provider-note">
                  Make sure Ollama is running locally. Install from <a href="https://ollama.ai/" target="_blank">ollama.ai</a>
                </p>
              {/if}
            </div>
          {/each}

          <div class="usage-info">
            <h4>Usage:</h4>
            <ul>
              <li><kbd>Ctrl+Space</kbd> - Trigger code completion</li>
              <li><kbd>Ctrl+Shift+G</kbd> - Generate code from prompt</li>
              <li>Type <code>//</code> followed by a description to generate code</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .ai-settings {
    position: relative;
  }

  .settings-toggle {
    background: #1a1a1a;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  .settings-toggle:hover {
    background: #1a1a1a;
  }

  .settings-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .settings-content {
    background: white;
    border-radius: 0.5rem;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .settings-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: #374151;
  }

  .settings-body {
    padding: 1.5rem;
  }

  .provider-selection {
    margin-bottom: 2rem;
  }

  .provider-selection label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .provider-selection select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .provider-config {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .provider-config.active {
    opacity: 1;
    border-color: #1a1a1a;
    background: #f8fafc;
  }

  .provider-config h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    color: #374151;
  }

  .form-group input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: #1a1a1a;
    box-shadow: 0 0 0 3px rgba(26, 26, 26, 0.1);
  }

  .test-btn {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .test-btn:hover:not(:disabled) {
    background: #059669;
  }

  .test-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .provider-note {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.4;
  }

  .provider-note a {
    color: #1a1a1a;
    text-decoration: none;
  }

  .provider-note a:hover {
    text-decoration: underline;
  }

  .usage-info {
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
    margin-top: 2rem;
  }

  .usage-info h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .usage-info ul {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .usage-info li {
    margin-bottom: 0.25rem;
  }

  .usage-info kbd {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    padding: 0.125rem 0.25rem;
    font-size: 0.75rem;
    font-family: monospace;
  }

  .usage-info code {
    background: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-family: monospace;
  }
</style>