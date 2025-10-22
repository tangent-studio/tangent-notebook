<script lang="ts">
  import type { CellOutput } from '../types/notebook';
  import JSONFormatter from 'json-formatter-js';

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

  // Render collapsible JSON using json-formatter-js
  function renderJson(node: HTMLElement, value: string | object | null | undefined) {
    let formatterEl: HTMLElement | null = null;

    const render = (next: typeof value) => {
      node.innerHTML = '';
      formatterEl = null;

      if (next === undefined || next === null) {
        return;
      }

      let parsed: any = next;
      if (typeof next === 'string') {
        try {
          parsed = JSON.parse(next);
        } catch {
          parsed = null;
        }
      }

      if (parsed !== null) {
        try {
          const formatter = new JSONFormatter(parsed, 1, {
            hoverPreviewEnabled: true
          });
          formatterEl = formatter.render();
          node.appendChild(formatterEl);
          return;
        } catch {
          formatterEl = null;
        }
      }

      const pre = document.createElement('pre');
      pre.className = 'json-output';
      pre.textContent = typeof next === 'string'
        ? formatJSON(next)
        : JSON.stringify(next, null, 2);
      node.appendChild(pre);
    };

    render(value);

    return {
      update(next: typeof value) {
        render(next);
      },
      destroy() {
        node.innerHTML = '';
        formatterEl = null;
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
      <div class="json-tree" use:renderJson={output.content}></div>
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
    margin-top: 0.75rem;
    border-top: 1px solid #ededed;
    padding-top: 0.6rem;
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

  .output-content :global(.tangent-table-output) {
    width: 100%;
    border-collapse: collapse;
    font-family: 'Fira Code', 'Fira Sans', sans-serif;
    font-size: 0.75rem;
    line-height: 1.45;
    color: #2d2d2d;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }

  .output-content :global(.tangent-table-output thead) {
    background-color: #f4f5f7;
  }

  .output-content :global(.tangent-table-output th),
  .output-content :global(.tangent-table-output td) {
    border: 1px solid #eceef1;
    padding: 0.35rem 0.6rem;
    text-align: right;
    white-space: nowrap;
  }

  .output-content :global(.tangent-table-output th) {
    font-weight: 600;
    color: #1f2933;
    letter-spacing: 0.01em;
  }

  .output-content :global(.tangent-table-output tbody tr:nth-child(even)) {
    background-color: #fafbfc;
  }

  .json-output,
  .text-output {
    font-size: 0.825rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    padding: 0.6rem 0.85rem;
    background-color: #fafafa;
    border-radius: 5px;
    border: 1px solid #e8e8e8;
    line-height: 1.5;
  }

  .json-output {
    color: #7c3aed;
  }

  .json-tree {
    font-size: 0.825rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background-color: #fafafa;
    border-radius: 5px;
    border: 1px solid #e8e8e8;
    padding: 0.4rem 0.6rem;
    overflow-x: auto;
  }

  .json-tree :global(.json-formatter-row) {
    font-family: inherit;
    line-height: 1.4;
  }

  .json-tree :global(.json-formatter-row .json-formatter-toggler) {
    cursor: pointer;
    display: inline-block;
    user-select: none;
  }

  .json-tree :global(.json-formatter-row .json-formatter-toggler:before) {
    content: "▸";
    display: inline-block;
    transform: rotate(0deg);
    transition: transform 0.1s ease;
    margin-right: 4px;
  }

  .json-tree :global(.json-formatter-row.json-formatter-open .json-formatter-toggler:before) {
    transform: rotate(90deg);
  }

  .json-tree :global(.json-formatter-row > a.json-formatter-key) {
    color: #2563eb;
    text-decoration: none;
  }

  .json-tree :global(.json-formatter-row .json-formatter-number) {
    color: #16a34a;
  }

  .json-tree :global(.json-formatter-row .json-formatter-string) {
    color: #d97706;
  }

  .json-tree :global(.json-formatter-row .json-formatter-boolean) {
    color: #9333ea;
  }

  .json-tree :global(.json-formatter-row .json-formatter-null) {
    color: #6b7280;
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
