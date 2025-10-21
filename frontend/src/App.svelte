<script lang="ts">
  import { onMount } from 'svelte';
  import Notebook from './lib/components/Notebook.svelte';
  import RightSidebar from './lib/components/RightSidebar.svelte';
  import ExportDialog from './lib/components/ExportDialog.svelte';
  import { currentNotebook, notebookFiles, createNewNotebook } from './lib/stores/notebook';

  let rightSidebarOpen = false;
  let showExportDialog = false;

  // Export function for child component to call
  export function runAllCells() {
    window.dispatchEvent(new CustomEvent('run-all-cells'));
  }

  onMount(() => {
    // Try to load a sample notebook bundled with the frontend
    (async () => {
      try {
        const res = await fetch('/sample-notebooks/plotting-demo.json');
        if (res.ok) {
          const sample = await res.json();
          currentNotebook.set(sample);
        } else {
          const newNotebook = createNewNotebook();
          currentNotebook.set(newNotebook);
        }
      } catch (e) {
        const newNotebook = createNewNotebook();
        currentNotebook.set(newNotebook);
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
    console.info('New notebook created');
  }

  function handleImportNotebook() {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const notebook = JSON.parse(text);

        // Validate that it's a valid notebook
        if (!notebook.id || !notebook.cells || !Array.isArray(notebook.cells)) {
          alert('Invalid notebook file format');
          return;
        }

        currentNotebook.set(notebook);
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
</script>

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
    padding: 0.5rem 1.5rem;
    background-color: #ffffff;
    border-bottom: 1px solid #e8e8e8;
    height: 48px;
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
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #6b6b6b;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .notebooks-btn:hover {
    background-color: #f5f5f5;
    color: #1a1a1a;
  }

  .icon-btn {
    background: transparent;
    border: none;
    padding: 0.5rem;
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
    font-size: 0.875rem;
    color: #6b6b6b;
  }

  .header-separator {
    color: #d0d0d0;
    font-size: 0.875rem;
  }

  .run-all-header-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background-color: #1a1a1a;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8125rem;
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
