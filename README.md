# Tangent Notebook

> pre-alpha, bugs expected

A JavaScript notebook application built with SvelteKit and TypeScript. Create, edit, and execute JavaScript notebooks with rich visualizations in a clean, professional interface.

## Features

### Core Functionality
- **Interactive Notebooks**: Create and edit notebooks with multiple code and markdown cells
- **JavaScript/ESM Execution**: Run modern JavaScript with ES module imports directly in browser
- **NPM Package Support**: Import any npm package via CDN (d3, arquero, vega-lite, plotly, etc.)
- **Rich Output Rendering**: Display text, HTML, SVG, JSON, and interactive visualizations
- **Import/Export**: Load and save notebook files as js file
- **Monaco-style Editing**: Professional code editing with syntax highlighting
- **Responsive Design**: Clean, modern interface that works on all screen sizes

### Data Science Ready
- **D3.js**: Full support for D3 visualizations
- **Observable Plot**: Create charts with Observable's plotting library
- **Arquero**: Data manipulation with Arquero dataframes
- **Vega-Lite**: Declarative visualization grammar
- **Remote Data**: Load CSV/JSON from URLs with d3.csv(), d3.json(), fetch()

### User Experience
- **Keyboard Shortcuts**: Efficient workflow with `Shift+Enter` and `Ctrl+Enter` to run cells
- **Cell Management**: Add, delete, reorder, and switch between Code/Markdown cells
- **Live Updates**: Real-time cell count and modification timestamps
- **Minimalist UI**: Clean, distraction-free interface inspired by Observable

## Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd tangent-notebook/frontend
   ```

2. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   - Navigate to `http://localhost:5173`
   - Start creating notebooks immediately!

### Building for Production

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/` - deploy to any static hosting (Vercel, Netlify, GitHub Pages, etc.)

## Usage

### Creating Your First Notebook

1. **Start fresh** - Click "+ New" to create a blank notebook
2. **Import sample** - Click "Import" to load an existing notebook JSON file
3. **Add cells** - Use the "+ Add Cell" button to create new cells
4. **Write code** - Click in a cell to start coding
5. **Execute** - Press `Shift+Enter` or click the "▶" button
6. **See results** - Output appears below each cell instantly

### Variable Scope Between Cells

Each code cell executes inside its own wrapper function. Keep these rules in mind when sharing values between cells:

- Use `let` or `const` when the value is only needed inside the current cell. Those bindings are scoped to that cell and disappear once it finishes running.
- Assigning to a name without `let/const/var` stores the value in the notebook's shared scope. Later cells can read or overwrite it:
  ```javascript
  counter = (counter ?? 0) + 1; // persists across cells
  ```
- Explicitly writing to `globalThis.foo = ...` does the same thing; it simply makes the intent clearer.

This matches Observable-style behavior: scoped variables stay local, while bare assignments become shared state for subsequent cells.

### Example: Data Visualization

```javascript
// Import D3 and load data
import * as d3 from 'd3';

const data = await d3.csv('https://raw.githubusercontent.com/vega/vega-datasets/master/data/cars.csv');

console.log(`Loaded ${data.length} rows`);
data.slice(0, 5)
```

```javascript
// Import Observable Plot
import * as Plot from '@observablehq/plot';

const chart = Plot.plot({
  marks: [
    Plot.dot(data, {
      x: 'Horsepower',
      y: 'Miles_per_Gallon',
      fill: 'Origin',
      title: 'Name'
    })
  ],
  grid: true,
  color: { legend: true }
});

chart
```

```javascript
// Create D3 bar chart
const svg = d3.create('svg')
  .attr('width', 600)
  .attr('height', 400);

const values = [12, 19, 3, 5, 2, 15, 25, 8];
const barWidth = 60;

svg.selectAll('rect')
  .data(values)
  .join('rect')
  .attr('x', (d, i) => i * 70 + 20)
  .attr('y', d => 350 - d * 10)
  .attr('width', barWidth)
  .attr('height', d => d * 10)
  .attr('fill', 'steelblue');

svg.node()
```

### Example: Data Analysis with Arquero

```javascript
import * as aq from 'arquero';

// Create a table
const dt = aq.table({
  name: ['Alice', 'Bob', 'Charlie', 'Diana'],
  age: [25, 30, 35, 28],
  score: [85, 92, 78, 95]
});

// Transform and analyze
const summary = dt
  .filter(d => d.age > 27)
  .derive({ grade: d => d.score >= 90 ? 'A' : 'B' })
  .orderby(aq.desc('score'));

console.log(summary.toString());
summary.objects()
```

### Markdown Support

Switch cell type to "Markdown" for documentation:

```markdown
# Data Analysis Results

This notebook demonstrates:

- **Data Loading**: Fetching CSV from remote URLs
- **Visualization**: D3.js and Observable Plot
- **Data Manipulation**: Arquero for dataframe operations
- **Interactive Output**: Real-time code execution

## Key Findings

The analysis shows a clear correlation between horsepower and fuel efficiency.
```

## 🏗️ Architecture

### Tech Stack
- **Frontend Framework**: SvelteKit with TypeScript
- **Build Tool**: Vite
- **Code Editor**: Monaco-style editing with syntax highlighting
- **Module System**: ESM with CDN resolution (esm.sh)
- **Styling**: Custom CSS with clean, minimalist design

### Key Components

- **Notebook.svelte**: Main notebook interface, cell orchestration, keyboard shortcuts
- **Cell.svelte**: Individual cell with code editor, markdown rendering, and toolbar
- **jsExecutor.ts**: JavaScript execution engine with:
  - ESM module support via blob URLs
  - Automatic CDN resolution for npm packages
  - Console output capture
  - DOM element rendering (HTML/SVG)
- **ExportDialog.svelte**: Export notebooks as JSON, HTML, or PDF

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift + Enter` | Run current cell and move to next |
| `Ctrl/Cmd + Enter` | Run current cell |

## File Format

Tangent Notebook uses a **text-based format** inspired by Jupytext, making notebooks git-friendly and human-readable.

### Text Format (.js)

Notebooks are saved as JavaScript files with special cell delimiters:

```javascript
// ---
// title: My Notebook
// id: notebook-unique-id
// ---

// %% [markdown]
/*
# My Analysis

This is a markdown cell.
*/

// %% [javascript]

const data = [1, 2, 3, 4, 5];
console.log('Data:', data);
```

**Advantages:**
- **Git-friendly**: No timestamps, easy to diff and merge
- **Human-readable**: Plain text, editable in any editor
- **Syntax highlighting**: Works with JavaScript highlighters
- **Compact**: No verbose JSON structure

See [NOTEBOOK_FORMAT.md](NOTEBOOK_FORMAT.md) for detailed format specification.

### Import/Export
- **Import**: Click "Import" button, select a `.js` notebook file
- **Export**: Click "Export" button, choose format (JS, HTML, PDF)

## Supported Libraries

Any ESM-compatible package should be importable.

## Deployment

### Static Hosting

The app is a static SPA - deploy anywhere:

**Vercel:**
```bash
cd frontend
npm run build
vercel --prod
```

**Netlify:**
```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

**GitHub Pages:**
```bash
cd frontend
npm run build
# Copy dist/ contents to gh-pages branch
```

## 📄 License

MIT License - see LICENSE file for details.

## Acknowledgments

Inspired by:
- **Observable** - For reactive notebooks and excellent UX
- **Jupyter** - For establishing the notebook paradigm
- **Starboard Notebook** - For browser-first approach
- **Marimo** - For clean, minimalist design

---

Built mostly with vibe coding and a lot of copy-pasting errors.
