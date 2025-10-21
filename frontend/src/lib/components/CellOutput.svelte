<script lang="ts">
  import type { CellOutput } from '../types/notebook';

  export let output: CellOutput;

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  function isValidJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  function formatJSON(str: string): string {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }

  // Action to insert a live DOM element
  function insertLiveElement(node: HTMLElement, element: Element | null) {
    if (element) {
      node.appendChild(element);
    }
    return {
      destroy() {
        if (element && node.contains(element)) {
          node.removeChild(element);
        }
      }
    };
  }
</script>

<div class="output-container" data-testid="cell-output">
  <div class="output-content {output.type}">
    {#if output.type === 'dom'}
      <div class="dom-output" use:insertLiveElement={output.content}></div>
    {:else if output.type === 'html'}
      <div class="html-output">
        {@html output.content}
      </div>
    {:else if output.type === 'json' || isValidJSON(String(output.content))}
      <pre class="json-output"><code>{formatJSON(String(output.content))}</code></pre>
    {:else if output.type === 'error'}
      <div class="error-output">
        <div class="error-header">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="7" fill="#fee2e2"/>
            <path d="M8 4v5M8 11v1" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="error-label">Error</span>
        </div>
        <pre class="error-message"><code>{String(output.content)}</code></pre>
      </div>
    {:else}
      <pre class="text-output"><code>{String(output.content)}</code></pre>
    {/if}
  </div>

  <div class="output-footer">
    <span class="output-timestamp">{formatTimestamp(output.timestamp)}</span>
  </div>
</div>

<style>
  .output-container {
    margin-top: 1rem;
    border-top: 1px solid #e8e8e8;
    padding-top: 0.75rem;
  }

  .output-content {
    margin-bottom: 0.5rem;
  }

  .dom-output,
  .html-output {
    max-width: 100%;
    overflow-x: auto;
  }

  .dom-output :global(svg),
  .html-output :global(svg) {
    max-width: 100%;
    height: auto;
  }

  .json-output,
  .text-output {
    font-size: 0.875rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    padding: 0.75rem 1rem;
    background-color: #fafafa;
    border-radius: 6px;
    border: 1px solid #e8e8e8;
    line-height: 1.5;
  }

  .json-output {
    color: #7c3aed;
  }

  .text-output {
    color: #1a1a1a;
  }

  .error-output {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 0.75rem 1rem;
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .error-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #dc2626;
  }

  .error-message {
    font-size: 0.875rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: #991b1b;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  }

  .output-footer {
    display: flex;
    justify-content: flex-end;
    padding: 0 0.25rem;
  }

  .output-timestamp {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .output-content code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
  }

  /* Ensure D3/Plot visualizations display properly */
  .html-output :global(.plot) {
    max-width: 100%;
    overflow-x: auto;
  }

  .html-output :global(.plot svg) {
    max-width: 100%;
    height: auto;
  }
</style>
