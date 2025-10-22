<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import Notebook from './lib/components/Notebook.svelte';
  import RightSidebar from './lib/components/RightSidebar.svelte';
  import ExportDialog from './lib/components/ExportDialog.svelte';
  import { currentNotebook, notebookFiles, createNewNotebook, markNotebookClean, notebookDirty } from './lib/stores/notebook';
  import { ExportService } from './lib/utils/exportService';

  let rightSidebarOpen = false;
  let showExportDialog = false;
  const exportService = new ExportService();

  // Export function for child component to call
  export function runAllCells() {
    window.dispatchEvent(new CustomEvent('run-all-cells'));
  }

  function parseJSNotebook(text, filename = 'notebook.js') {
    const lines = text.split('\n');
    const metadata: Record<string, string> = {};
    const cells: any[] = [];
    let currentCell: any = null;
    let inMetadata = false;
    let inMarkdown = false;
    let markdownContent = '';
    let codeContent = '';

    const slugify = (value: string): string =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .trim();

    const deriveDefaultName = () => {
      if (!filename) return '';
      const base = filename.replace(/\.[^.]+$/, '');
      const spaced = base.replace(/[-_]+/g, ' ').trim();
      return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
    };

    const defaultName = deriveDefaultName();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const withoutComment = trimmed.replace(/^\/\/\s*/, '');

      if (withoutComment === '---') {
        if (!inMetadata) {
          inMetadata = true;
        } else {
          inMetadata = false;
        }
        continue;
      }

      if (inMetadata) {
        const match = withoutComment.match(/^([\w-]+):\s*(.+)$/);
        if (match) {
          metadata[match[1]] = match[2].trim();
        }
        continue;
      }

      if (line.startsWith('// %% ')) {
        if (currentCell) {
          if (currentCell.type === 'markdown') {
            currentCell.content = markdownContent.trim();
          } else if (currentCell.type === 'code') {
            currentCell.content = codeContent.trim();
          }
          cells.push(currentCell);
        }

        const typeMatch = line.match(/\/\/ %% \[(\w+)\]/);
        if (typeMatch) {
          const type = typeMatch[1];
          currentCell = {
            id: `cell-${cells.length + 1}`,
            type: type === 'javascript' ? 'code' : type,
            content: '',
            output: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
          };
          inMarkdown = false;
          markdownContent = '';
          codeContent = '';
        }
        continue;
      }

      if (currentCell) {
        if (currentCell.type === 'markdown') {
          if (line.startsWith('/*')) {
            inMarkdown = true;
          } else if (line.startsWith('*/')) {
            inMarkdown = false;
          } else if (inMarkdown) {
            markdownContent += line + '\n';
          }
        } else if (currentCell.type === 'code') {
          codeContent += line + '\n';
        }
      }
    }

    if (currentCell) {
      if (currentCell.type === 'markdown') {
        currentCell.content = markdownContent.trim();
      } else if (currentCell.type === 'code') {
        currentCell.content = codeContent.trim();
      }
      cells.push(currentCell);
    }

    const notebookName =
      (metadata.title && metadata.title.length > 0 ? metadata.title : defaultName) ||
      'Sample Notebook';
    const notebookId =
      (metadata.id && metadata.id.length > 0 ? metadata.id : slugify(notebookName)) ||
      `notebook-${Date.now()}`;

    return {
      id: notebookId,
      name: notebookName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cells,
    };
  }

  onMount(() => {
    // Try to load a sample notebook bundled with the frontend
    (async () => {
      try {
        const res = await fetch('/sample-notebooks/climate-ecology-data-template.js');
        if (res.ok) {
          const text = await res.text();
          const sample = parseJSNotebook(text, 'climate-ecology-data-template.js');
          currentNotebook.set(sample);
          markNotebookClean();
        } else {
          const newNotebook = createNewNotebook();
          currentNotebook.set(newNotebook);
          markNotebookClean();
        }
      } catch (e) {
        const newNotebook = createNewNotebook();
        currentNotebook.set(newNotebook);
        markNotebookClean();
      }

      // Load saved notebooks list (mock/backend)
      loadNotebookFiles();
    })();
  });

  async function loadNotebookFiles() {
    // TODO: Implement loading notebook files from Go backend
    // For now, we'll use mock data
    notebookFiles.set([]);
  }

function handleNewNotebook() {
  const newNotebook = createNewNotebook();
  currentNotebook.set(newNotebook);
  markNotebookClean();
  console.info('New notebook created');
}

  function handleImportNotebook() {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.js';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        let notebook;

        if (file.name.toLowerCase().endsWith('.js')) {
          notebook = parseJSNotebook(text, file.name);
        } else {
          notebook = JSON.parse(text);
        }

        // Validate that it's a valid notebook
        if (!notebook.id || !notebook.cells || !Array.isArray(notebook.cells)) {
          alert('Invalid notebook file format');
          return;
        }

        currentNotebook.set(notebook);
        markNotebookClean();
        console.info('Notebook imported successfully');
      } catch (err) {
        console.error('Import failed:', err);
        alert('Failed to import notebook: ' + err.message);
      }
    };
    input.click();
  }

  function handleExportNotebook() {
    showExportDialog = true;
  }

  function toggleRightSidebar() {
    rightSidebarOpen = !rightSidebarOpen;
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      performSaveShortcut();
    }
  }

  async function performSaveShortcut() {
    const notebook = get(currentNotebook);
    if (!notebook) return;
    const baseName = slugify(notebook.name || 'notebook');
    try {
      const content = await exportService.exportNotebook(notebook, {
        includeCode: true,
        includeOutputs: true,
        includeTimestamps: false,
        theme: 'light',
        format: 'js'
      });
      downloadText(content as string, `${baseName}.js`, 'text/javascript');
      markNotebookClean();
      console.info('Notebook checkpoint exported as .js');
    } catch (err) {
      console.error('Save failed', err);
      alert('Failed to export notebook. See console for details.');
    }
  }

  function slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim() || 'notebook';
  }

  function downloadText(text: string, filename: string, mime: string) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="app-container">
  <!-- Observable-style header -->
  <header class="app-header">
    <div class="header-left">
      <button class="notebooks-btn" on:click={handleNewNotebook} title="New Notebook">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3v10M3 8h10"/>
        </svg>
        New
      </button>
      <button class="notebooks-btn" on:click={handleImportNotebook} title="Import Notebook">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 10v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2M8 2v9M5 8l3 3 3-3"/>
        </svg>
        Import
      </button>
      <button class="notebooks-btn" on:click={handleExportNotebook} title="Export Notebook">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 10v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2M8 11V3M5 6l3-3 3 3"/>
        </svg>
        Export
      </button>
    </div>

    <div class="header-right">
      {#if $currentNotebook}
        {#if $notebookDirty}
          <span class="unsaved-dot" title="Unsaved changes — press Ctrl/Cmd+S to checkpoint"></span>
        {/if}
        <span class="header-meta">Updated {new Date($currentNotebook.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span class="header-separator">•</span>
        <span class="header-meta">{$currentNotebook.cells.length} cells</span>
        <span class="header-separator">•</span>
        <button
          class="run-all-header-btn"
          on:click={() => window.dispatchEvent(new CustomEvent('run-all-cells'))}
          title="Run All Cells"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 2l9 5-9 5V2z"/>
          </svg>
          Run All
        </button>
        <span class="header-separator">•</span>
      {/if}
      <button class="icon-btn" on:click={toggleRightSidebar} title="Info">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="10" cy="10" r="8"/>
          <path d="M10 14v-4M10 6v.5"/>
        </svg>
      </button>
    </div>
  </header>

  <div class="content-wrapper">
    <main class="main-content">
      <Notebook />
    </main>

    {#if rightSidebarOpen}
      <aside class="right-sidebar-container">
        <RightSidebar on:close={() => rightSidebarOpen = false} />
      </aside>
    {/if}
  </div>

  {#if showExportDialog}
    <ExportDialog on:close={() => showExportDialog = false} />
  {/if}
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: #ffffff;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 1.25rem;
    background-color: #ffffff;
    border-bottom: 1px solid #e8e8e8;
    height: 44px;
    position: relative;
    z-index: 50;
  }

  .header-left,
  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .notebooks-btn {
    background: transparent;
    border: none;
    padding: 0.4rem 0.65rem;
    font-size: 0.8125rem;
    color: #6b6b6b;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .notebooks-btn:hover {
    background-color: #f5f5f5;
    color: #1a1a1a;
  }

  .icon-btn {
    background: transparent;
    border: none;
    padding: 0.35rem;
    color: #6b6b6b;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background-color: #f5f5f5;
    color: #1a1a1a;
  }

  .header-meta {
    font-size: 0.8125rem;
    color: #666666;
  }

  .header-separator {
    color: #d0d0d0;
    font-size: 0.8125rem;
  }

  .unsaved-dot {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
    margin-right: 0.45rem;
  }

  .run-all-header-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.65rem;
    background-color: #1a1a1a;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .run-all-header-btn:hover {
    background-color: #000000;
  }

  .content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .right-sidebar-container {
    width: 280px;
    border-left: 1px solid #e8e8e8;
    background-color: #fafafa;
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    .right-sidebar-container {
      position: fixed;
      right: 0;
      top: 48px;
      bottom: 0;
      z-index: 30;
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    }
  }
</style>
