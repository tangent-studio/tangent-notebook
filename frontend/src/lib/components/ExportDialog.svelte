<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentNotebook } from '../stores/notebook';
  import { serializeNotebook } from '../utils/notebookFormat';

  const dispatch = createEventDispatcher();
  
  let exportFormat = 'js';

  function handleExport() {
    const notebook = $currentNotebook;
    if (!notebook) return;
    
    if (exportFormat === 'js') {
      exportJS(notebook);
    } else if (exportFormat === 'json') {
      exportJSON(notebook);
    } else if (exportFormat === 'html') {
      exportHTML(notebook);
    } else if (exportFormat === 'pdf') {
      exportPDF(notebook);
    }
    
    dispatch('close');
  }
  
  function exportJS(notebook: any) {
    const textContent = serializeNotebook(notebook);
    const dataUri = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(textContent);
    const filename = `${notebook.name.replace(/\s+/g, '-')}.js`;
    downloadFile(dataUri, filename);
  }
  
  function exportJSON(notebook: any) {
    const dataStr = JSON.stringify(notebook, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const filename = `${notebook.name.replace(/\s+/g, '-')}.json`;
    downloadFile(dataUri, filename);
  }
  
  function exportHTML(notebook: any) {
    const html = `<!DOCTYPE html>
<html lang=\"en\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>${notebook.name}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 960px;
            margin: 0 auto;
            padding: 2rem;
            background: #ffffff;
            color: #1a1a1a;
        }
        h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 1rem;
        }
        .meta {
            color: #6b6b6b;
            font-size: 0.875rem;
            margin-bottom: 2rem;
        }
        .cell {
            margin-bottom: 2rem;
            border: 1px solid #e8e8e8;
            border-radius: 8px;
            overflow: hidden;
        }
        .cell-header {
            background: #f5f5f5;
            padding: 0.5rem 1rem;
            font-size: 0.75rem;
            color: #6b6b6b;
            text-transform: uppercase;
            font-weight: 600;
        }
        .cell-content {
            padding: 1rem;
        }
        pre {
            background: #fafafa;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.875rem;
        }
        .output {
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid #e8e8e8;
        }
        .markdown-content {
            line-height: 1.7;
        }
    </style>
</head>
<body>
    <h1>${notebook.name}</h1>
    <div class=\"meta\">
        ${notebook.cells.length} cells • 
        Modified: ${new Date(notebook.updatedAt).toLocaleString()}
    </div>
    ${notebook.cells.map((cell: any) => {
      if (cell.type === 'markdown') {
        return `<div class=\"cell\">
          <div class=\"cell-header\">Markdown</div>
          <div class=\"cell-content markdown-content\">${cell.content}</div>
        </div>`;
      } else {
        return `<div class=\"cell\">
          <div class=\"cell-header\">Code</div>
          <div class=\"cell-content\">
            <pre><code>${cell.content}</code></pre>
            ${cell.output ? `<div class=\"output\"><pre><code>${cell.output.content}</code></pre></div>` : ''}
          </div>
        </div>`;
      }
    }).join('')}
</body>
</html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const filename = `${notebook.name.replace(/\\s+/g, '-')}.html`;
    downloadFile(url, filename);
    URL.revokeObjectURL(url);
  }
  
  function exportPDF(notebook: any) {
    // Generate HTML first
    exportHTML(notebook);
    // Show instructions
    alert('HTML file exported. To convert to PDF:\\n\\n1. Open the HTML file in your browser\\n2. Press Ctrl/Cmd + P (Print)\\n3. Select \"Save as PDF\" as the destination\\n4. Click Save');
  }
  
  function downloadFile(dataUri: string, filename: string) {
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', filename);
    linkElement.click();
  }

  function handleClose() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />
<div class="export-modal">
  <div class="export-content">
    <div class="export-header">
      <h3>Export Notebook</h3>
      <button class="close-btn" on:click={handleClose}>×</button>
    </div>

    <div class="export-body">
      {#if $currentNotebook}
        <div class="notebook-info">
          <h4>{$currentNotebook.name}</h4>
          <p>{$currentNotebook.cells.length} cells • Modified {new Date($currentNotebook.updatedAt).toLocaleDateString()}</p>
        </div>

        <div class="export-options">
          <div class="option-group">
            <h5>Export Format</h5>
            <div class="radio-group">
              <label>
                <input type="radio" bind:group={exportFormat} value="js" />
                <span class="radio-label">
                  <strong>JavaScript (.js)</strong>
                  <small>Text format with // %% delimiters (git-friendly, can be re-imported)</small>
                </span>
              </label>
              <label>
                <input type="radio" bind:group={exportFormat} value="json" />
                <span class="radio-label">
                  <strong>JSON</strong>
                  <small>Raw notebook data (verbose, includes metadata)</small>
                </span>
              </label>
              <label>
                <input type="radio" bind:group={exportFormat} value="html" />
                <span class="radio-label">
                  <strong>HTML</strong>
                  <small>Standalone web page with all content</small>
                </span>
              </label>
              <label>
                <input type="radio" bind:group={exportFormat} value="pdf" />
                <span class="radio-label">
                  <strong>PDF</strong>
                  <small>Exports as HTML, then use browser's Print to PDF</small>
                </span>
              </label>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="export-footer">
      <button class="cancel-btn" on:click={handleClose}>
        Cancel
      </button>
      <button 
        class="export-btn" 
        on:click={handleExport}
      >
        Export as {exportFormat.toUpperCase()}
      </button>
    </div>
  </div>
</div>

<style>
  .export-modal {
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

  .export-content {
    background: white;
    border-radius: 0.5rem;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .export-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .export-header h3 {
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

  .export-body {
    padding: 1.5rem;
  }

  .notebook-info {
    margin-bottom: 2rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.375rem;
  }

  .notebook-info h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .notebook-info p {
    margin: 0;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .export-options {
    space-y: 1.5rem;
  }

  .option-group {
    margin-bottom: 1.5rem;
  }

  .option-group h5 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .radio-group label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
    transition: background-color 0.2s;
  }

  .radio-group label:hover {
    background: #f9fafb;
  }

  .radio-label {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .radio-label strong {
    font-weight: 600;
  }

  .radio-label small {
    font-size: 0.75rem;
    color: #6b7280;
  }

  input[type="radio"] {
    margin: 0;
    margin-top: 0.125rem;
  }

  .export-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .cancel-btn, .export-btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .cancel-btn:hover:not(:disabled) {
    background: #f9fafb;
  }

  .export-btn {
    background: #1a1a1a;
    color: white;
    border: 1px solid #1a1a1a;
  }

  .export-btn:hover:not(:disabled) {
    background: #1a1a1a;
  }

  .cancel-btn:disabled, .export-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>