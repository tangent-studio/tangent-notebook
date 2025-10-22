<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentNotebook } from '../stores/notebook';

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }
</script>

<div class="right-sidebar">
  <div class="sidebar-header">
    <h3 class="sidebar-title">Notebook Info</h3>
    <button class="close-btn" on:click={handleClose}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="4" y1="4" x2="12" y2="12"/>
        <line x1="12" y1="4" x2="4" y2="12"/>
      </svg>
    </button>
  </div>

  {#if $currentNotebook}
    <div class="sidebar-content">
      <div class="info-section">
        <div class="info-label">Cells</div>
        <div class="info-value">{$currentNotebook.cells.length}</div>
      </div>

      <div class="info-section">
        <div class="info-label">Created</div>
        <div class="info-value">{new Date($currentNotebook.createdAt).toLocaleDateString()}</div>
      </div>

      <div class="info-section">
        <div class="info-label">Last Modified</div>
        <div class="info-value">{new Date($currentNotebook.updatedAt).toLocaleString()}</div>
      </div>

      <div class="divider"></div>

      <div class="shortcuts-section">
        <h4 class="section-title">Keyboard Shortcuts</h4>
        <div class="shortcut-item">
          <span class="shortcut-key">Shift + Enter</span>
          <span class="shortcut-desc">Run cell</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Ctrl/Cmd + S</span>
          <span class="shortcut-desc">Save notebook</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Ctrl/Cmd + Enter</span>
          <span class="shortcut-desc">Run cell</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .right-sidebar {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e8e8e8;
  }

  .sidebar-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    padding: 0.25rem;
    color: #6b6b6b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background-color: #f0f0f0;
    color: #1a1a1a;
  }

  .sidebar-content {
    padding: 1rem;
    overflow-y: auto;
  }

  .info-section {
    margin-bottom: 0.75rem;
  }

  .info-label {
    font-size: 0.75rem;
    color: #6b6b6b;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .info-value {
    font-size: 0.875rem;
    color: #1a1a1a;
    font-weight: 500;
  }

  .divider {
    height: 1px;
    background-color: #e8e8e8;
    margin: 1.1rem 0;
  }

  .shortcuts-section {
    margin-top: 1.25rem;
  }

  .section-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 0.75rem 0;
  }

  .shortcut-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .shortcut-key {
    font-size: 0.72rem;
    color: #6b6b6b;
    background-color: #f7f7f7;
    padding: 0.2rem 0.45rem;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
    font-family: monospace;
  }

  .shortcut-desc {
    font-size: 0.8125rem;
    color: #4a4a4a;
  }
</style>
