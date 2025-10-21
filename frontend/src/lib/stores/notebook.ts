import { writable } from 'svelte/store';
import type { Notebook, NotebookCell, NotebookFile } from '../types/notebook';

// Current notebook being edited
export const currentNotebook = writable<Notebook | null>(null);

// List of available notebook files
export const notebookFiles = writable<NotebookFile[]>([]);

// Currently selected cell
export const selectedCellId = writable<string | null>(null);

// Create a new notebook
export function createNewNotebook(): Notebook {
  const now = Date.now();
  return {
    id: `notebook-${now}`,
    name: 'Untitled Notebook',
    cells: [createNewCell()],
    createdAt: now,
    updatedAt: now
  };
}

// Create a new cell
export function createNewCell(type: 'code' | 'markdown' = 'code'): NotebookCell {
  return {
    id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    content: '',
    isRunning: false
  };
}

// Update cell content
export function updateCellContent(notebook: Notebook, cellId: string, content: string): Notebook {
  return {
    ...notebook,
    cells: notebook.cells.map(cell => 
      cell.id === cellId ? { ...cell, content } : cell
    ),
    updatedAt: Date.now()
  };
}

// Add cell after specified cell
export function addCellAfter(notebook: Notebook, afterCellId: string, type: 'code' | 'markdown' = 'code'): Notebook {
  const cellIndex = notebook.cells.findIndex(cell => cell.id === afterCellId);
  const newCell = createNewCell(type);
  const newCells = [...notebook.cells];
  newCells.splice(cellIndex + 1, 0, newCell);
  
  return {
    ...notebook,
    cells: newCells,
    updatedAt: Date.now()
  };
}

// Delete cell
export function deleteCell(notebook: Notebook, cellId: string): Notebook {
  if (notebook.cells.length <= 1) return notebook; // Don't delete the last cell
  
  return {
    ...notebook,
    cells: notebook.cells.filter(cell => cell.id !== cellId),
    updatedAt: Date.now()
  };
}

// Move cell up
export function moveCellUp(notebook: Notebook, cellId: string): Notebook {
  const cellIndex = notebook.cells.findIndex(cell => cell.id === cellId);
  if (cellIndex <= 0) return notebook;
  
  const newCells = [...notebook.cells];
  [newCells[cellIndex - 1], newCells[cellIndex]] = [newCells[cellIndex], newCells[cellIndex - 1]];
  
  return {
    ...notebook,
    cells: newCells,
    updatedAt: Date.now()
  };
}

// Move cell down
export function moveCellDown(notebook: Notebook, cellId: string): Notebook {
  const cellIndex = notebook.cells.findIndex(cell => cell.id === cellId);
  if (cellIndex >= notebook.cells.length - 1) return notebook;
  
  const newCells = [...notebook.cells];
  [newCells[cellIndex], newCells[cellIndex + 1]] = [newCells[cellIndex + 1], newCells[cellIndex]];
  
  return {
    ...notebook,
    cells: newCells,
    updatedAt: Date.now()
  };
}