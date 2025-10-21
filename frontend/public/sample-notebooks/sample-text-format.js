// ---
// title: Sample Text Format Notebook
// id: notebook-sample-text
// ---

// %% [markdown]
/*
# Welcome to Tangent Notebook

This notebook demonstrates the new **text-based format** for storing notebooks.

## Key Features

- **Git-friendly**: No timestamps in the file format
- **Human-readable**: Easy to read and edit
- **Simple delimiters**: Cells are separated with `// %% [type]`
- **Markdown support**: Wrapped in `/* */` comments
*/

// %% [javascript]

// Let's create some data
const data = [1, 2, 3, 4, 5];
console.log('Data:', data);
data

// %% [markdown]
/*
## Data Visualization

Now let's visualize this data using D3.js
*/

// %% [javascript]

// Import D3 from CDN
import * as d3 from 'd3';

// Create a simple bar chart
const svg = d3.create('svg')
  .attr('width', 400)
  .attr('height', 200);

const bars = svg.selectAll('rect')
  .data(data)
  .join('rect')
  .attr('x', (d, i) => i * 70 + 20)
  .attr('y', d => 150 - d * 20)
  .attr('width', 50)
  .attr('height', d => d * 20)
  .attr('fill', 'steelblue');

svg.node()

// %% [markdown]
/*
## Mathematical Expressions

You can also include inline math like $E = mc^2$ or block equations:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
*/

// %% [javascript]

// Calculate something
const sum = data.reduce((a, b) => a + b, 0);
const average = sum / data.length;

console.log(`Sum: ${sum}`);
console.log(`Average: ${average}`);

({ sum, average })
