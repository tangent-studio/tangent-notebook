<script lang="ts">
  import { onMount } from 'svelte';
  import Cell from './Cell.svelte';
  import { currentNotebook, selectedCellId } from '../stores/notebook';
  import { 
    updateCellContent, 
    addCellAfter, 
    deleteCell, 
    moveCellUp, 
    moveCellDown 
  } from '../stores/notebook';
  import { JavaScriptExecutor } from '../utils/jsExecutor';
  import type { NotebookCell } from '../types/notebook';
  
  let jsExecutor: JavaScriptExecutor;
  let isRunningAll = false;
  
  onMount(async () => {
    jsExecutor = new JavaScriptExecutor();
    // Load common libraries
    await jsExecutor.setupCommonLibraries();

    // Listen for run-all event from header
    const handleRunAllEvent = () => handleRunAll();
    window.addEventListener('run-all-cells', handleRunAllEvent);

    return () => {
      window.removeEventListener('run-all-cells', handleRunAllEvent);
    };
  });
  
  function handleContentChange(event: CustomEvent) {
    const { cellId, content } = event.detail;
    currentNotebook.update(notebook => {
      if (!notebook) return notebook;
      return updateCellContent(notebook, cellId, content);
    });
  }
  
  async function handleRunCell(event: CustomEvent) {
    const { cellId } = event.detail;

    // Get the current notebook state
    let notebook = null;
    const unsubscribe = currentNotebook.subscribe(n => notebook = n);
    unsubscribe();

    if (!notebook) return;

    // Find the cell to execute
    const cell = notebook.cells.find(c => c.id === cellId);
    if (!cell) return;

    // Markdown cells don't execute - they just render
    if (cell.type === 'markdown') {
      return;
    }

    // Set cell as running
    currentNotebook.update(notebook => {
      if (!notebook) return notebook;
      return {
        ...notebook,
        cells: notebook.cells.map(cell =>
          cell.id === cellId
            ? { ...cell, isRunning: true, output: undefined }
            : cell
        )
      };
    });

    try {
      if (!jsExecutor) {
        jsExecutor = new JavaScriptExecutor();
        await jsExecutor.setupCommonLibraries();
      }

      const output = await jsExecutor.executeCode(cell.content);

      currentNotebook.update(notebook => {
        if (!notebook) return notebook;
        return {
          ...notebook,
          cells: notebook.cells.map(cell =>
            cell.id === cellId
              ? { ...cell, isRunning: false, output }
              : cell
          )
        };
      });
    } catch (error) {
      currentNotebook.update(notebook => {
        if (!notebook) return notebook;
        return {
          ...notebook,
          cells: notebook.cells.map(cell =>
            cell.id === cellId
              ? {
                  ...cell,
                  isRunning: false,
                  output: {
                    type: 'error',
                    content: `Error: ${error.message}`,
                    timestamp: Date.now()
                  }
                }
              : cell
          )
        };
      });
    }
  }

  // Run all cells sequentially (including markdown)
  async function handleRunAll() {
    let notebook = null;
    const unsubscribe = currentNotebook.subscribe(n => notebook = n);
    unsubscribe();
    
    if (!notebook || isRunningAll) return;
    
    isRunningAll = true;
    
    // Run each cell in sequence
    for (const cell of notebook.cells) {
      if (cell.type === 'code') {
        await handleRunCell({ detail: { cellId: cell.id } });
        // Small delay between cells
        await new Promise(resolve => setTimeout(resolve, 100));
      } else if (cell.type === 'markdown') {
        // For markdown cells, dispatch a render event
        const event = new CustomEvent('render-markdown', { detail: { cellId: cell.id } });
        window.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    isRunningAll = false;
  }

  // Run current cell and move focus to next cell if present
  async function handleRunAndAdvance(event: CustomEvent) {
    const { cellId } = event.detail;
    await handleRunCell(event);

    // focus next
    let notebook = null;
    const unsub = currentNotebook.subscribe(n => notebook = n);
    unsub();
    if (!notebook) return;
    const idx = notebook.cells.findIndex(c => c.id === cellId);
    if (idx >= 0 && idx < notebook.cells.length - 1) {
      const next = notebook.cells[idx + 1];
      selectedCellId.set(next.id);
    }
  }
  
  function handleSelectCell(event: CustomEvent) {
    const { cellId } = event.detail;
    selectedCellId.set(cellId);
  }

  const UNTITLED = 'Untitled Notebook';

  function updateNotebookTitle(newTitle: string) {
    const title = newTitle.trim() || UNTITLED;
    currentNotebook.update((notebook) => {
      if (!notebook) return notebook;
      return {
        ...notebook,
        name: title,
        updatedAt: new Date().toISOString()
      };
    });
  }

  function handleTitleBlur(event: FocusEvent) {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    const raw = target.innerText.replace(/\s+/g, ' ');
    const sanitized = raw.trim() || UNTITLED;
    target.textContent = sanitized;
    updateNotebookTitle(sanitized);
  }

  function handleTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = event.currentTarget as HTMLElement | null;
      target?.blur();
    }
  }


  
  function handleAddCell(event: CustomEvent) {
    const { afterCellId } = event.detail;
    currentNotebook.update(notebook => {
      if (!notebook) return notebook;
      const updatedNotebook = addCellAfter(notebook, afterCellId);
      // Select the new cell
      const newCell = updatedNotebook.cells.find(cell => 
        !notebook.cells.some(oldCell => oldCell.id === cell.id)
      );
      if (newCell) {
        selectedCellId.set(newCell.id);
      }
      return updatedNotebook;
    });
  }
  
  function handleDeleteCell(event: CustomEvent) {
    const { cellId } = event.detail;
    currentNotebook.update(notebook => {
      if (!notebook) return notebook;
      return deleteCell(notebook, cellId);
    });
    
    // Clear selection if deleted cell was selected
    selectedCellId.update(selected => selected === cellId ? null : selected);
  }
  
  function handleMoveUp(event: CustomEvent) {
    const { cellId } = event.detail;
    currentNotebook.update(notebook => {
      if (!notebook) return notebook;
      return moveCellUp(notebook, cellId);
    });
  }
  
  function handleMoveDown(event: CustomEvent) {
    const { cellId } = event.detail;
    currentNotebook.update(notebook => {
      if (!notebook) return notebook;
      return moveCellDown(notebook, cellId);
    });
  }
  
  function handleCellTypeChange(event: CustomEvent) {
    const { cellId, type } = event.detail;
    currentNotebook.update(notebook => {
      if (!notebook) return notebook;
      return {
        ...notebook,
        cells: notebook.cells.map(cell => 
          cell.id === cellId 
            ? { ...cell, type, output: undefined }
            : cell
        )
      };
    });
  }
  
  // Keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    // Run cell: Ctrl/Cmd+Enter
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if ($selectedCellId) {
        // Check if it's a markdown cell
        let notebook = null;
        const unsub = currentNotebook.subscribe(n => notebook = n);
        unsub();
        const cell = notebook?.cells.find(c => c.id === $selectedCellId);
        
        if (cell?.type === 'markdown') {
          // Trigger markdown rendering
          const evt = new CustomEvent('render-markdown', { detail: { cellId: $selectedCellId } });
          window.dispatchEvent(evt);
        } else {
          handleRunCell({ detail: { cellId: $selectedCellId } });
        }
      }
      return;
    }

    // Run cell: Shift+Enter -> run and select next cell
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      if ($selectedCellId) {
        // Check if it's a markdown cell
        let notebook = null;
        const unsub = currentNotebook.subscribe(n => notebook = n);
        unsub();
        const cell = notebook?.cells.find(c => c.id === $selectedCellId);
        
        if (cell?.type === 'markdown') {
          // Trigger markdown rendering
          const evt = new CustomEvent('render-markdown', { detail: { cellId: $selectedCellId } });
          window.dispatchEvent(evt);
        } else {
          handleRunCell({ detail: { cellId: $selectedCellId } });
        }

        // Move focus to next cell (if exists)
        if (notebook) {
          const idx = notebook.cells.findIndex(c => c.id === $selectedCellId);
          if (idx >= 0 && idx < notebook.cells.length - 1) {
            const next = notebook.cells[idx + 1];
            selectedCellId.set(next.id);
          }
        }
      }
      return;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="notebook-container">
  {#if $currentNotebook}
    <!-- Observable-style header without breadcrumb -->
    <div class="notebook-header">
      <h1
        class="notebook-title"
        contenteditable="true"
        spellcheck="false"
        aria-label="Notebook title"
        data-testid="notebook-title"
        on:keydown={handleTitleKeydown}
        on:blur={handleTitleBlur}
      >
        {$currentNotebook.name}
      </h1>
    </div>
    
    <div class="cells-container">
      {#each $currentNotebook.cells as cell (cell.id)}
        <Cell 
          {cell}
          isSelected={$selectedCellId === cell.id}
          on:contentChange={handleContentChange}
          on:run={handleRunCell}
          on:runAndAdvance={handleRunAndAdvance}
          on:select={handleSelectCell}
          on:addCell={handleAddCell}
          on:deleteCell={handleDeleteCell}
          on:moveUp={handleMoveUp}
          on:moveDown={handleMoveDown}
          on:typeChange={handleCellTypeChange}
        />
      {/each}
    </div>
    
    <div class="notebook-footer">
      <button 
        class="add-cell-btn"
        on:click={() => handleAddCell({ detail: { afterCellId: $currentNotebook.cells[$currentNotebook.cells.length - 1].id } })}
        data-testid="add-cell-btn"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Add Cell
      </button>
    </div>
  {:else}
    <div class="empty-state">
      <h2>No notebook loaded</h2>
      <p>Create a new notebook or open an existing one to get started.</p>
    </div>
  {/if}
</div>

<style>
  .notebook-container {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 2rem 4rem;
  }
  
  .notebook-header {
    margin-bottom: 3rem;
  }
  
  .notebook-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 0.75rem 0;
    outline: none;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }
  
  .notebook-title:focus {
    background-color: #fffbeb;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .cells-container {
    margin-bottom: 2rem;
  }
  
  .notebook-footer {
    display: flex;
    justify-content: center;
    padding-top: 2rem;
  }
  
  .add-cell-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background-color: transparent;
    color: #6b6b6b;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .add-cell-btn:hover {
    background-color: #f5f5f5;
    border-color: #a0a0a0;
    color: #1a1a1a;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
  }
  
  .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 0.5rem;
  }
  
  .empty-state p {
    color: #6b6b6b;
    font-size: 0.9375rem;
  }
</style>
