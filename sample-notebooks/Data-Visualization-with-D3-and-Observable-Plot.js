// ---
// title: Data Visualization with D3 and Observable Plot
// id: plotting-demo
// ---

// %% [markdown]
/*
# Data Visualization Examples

This notebook demonstrates real plotting libraries:
- D3.js for custom visualizations
- Observable Plot for quick charts
- CSV and JSON data loading
*/

// %% [markdown]
/*
## D3.js Bar Chart

Creating an SVG bar chart with D3:
*/

// %% [javascript]
import * as d3 from 'd3';

const data = [12, 19, 3, 5, 2, 15, 25, 8];
const width = 600;
const height = 200;
const margin = { top: 20, right: 20, bottom: 30, left: 40 };

const x = d3.scaleBand()
  .domain(d3.range(data.length))
  .range([margin.left, width - margin.right])
  .padding(0.1);

const y = d3.scaleLinear()
  .domain([0, d3.max(data)])
  .range([height - margin.bottom, margin.top]);

const svg = d3.create('svg')
  .attr('width', width)
  .attr('height', height)
  .attr('viewBox', [0, 0, width, height]);

svg.selectAll('rect')
  .data(data)
  .join('rect')
  .attr('x', (d, i) => x(i))
  .attr('y', d => y(d))
  .attr('height', d => y(0) - y(d))
  .attr('width', x.bandwidth())
  .attr('fill', 'steelblue');

svg.selectAll('text')
  .data(data)
  .join('text')
  .attr('x', (d, i) => x(i) + x.bandwidth() / 2)
  .attr('y', d => y(d) - 5)
  .attr('text-anchor', 'middle')
  .attr('font-size', '12px')
  .text(d => d);

svg.node()

// %% [markdown]
/*
## Observable Plot

Plot provides a simpler API for common charts:
*/

// %% [javascript]
import * as Plot from '@observablehq/plot';

const plotData = [
  { category: 'A', value: 23 },
  { category: 'B', value: 45 },
  { category: 'C', value: 12 },
  { category: 'D', value: 67 },
  { category: 'E', value: 34 }
];

const chart = Plot.plot({
  marks: [
    Plot.barY(plotData, { x: 'category', y: 'value', fill: 'steelblue' })
  ],
  y: { grid: true },
  marginBottom: 40
});

chart

// %% [markdown]
/*
## Loading CSV Data

Use D3 to fetch and parse CSV files:
*/

// %% [javascript]
import * as d3 from 'd3';

// Load CSV from URL
const csvData = await d3.csv('https://raw.githubusercontent.com/vega/vega-datasets/master/data/cars.csv');

// Show first 5 rows
console.log('Loaded', csvData.length, 'rows');
csvData.slice(0, 5)

// %% [markdown]
/*
## Scatter Plot with Real Data
*/

// %% [javascript]
import * as Plot from '@observablehq/plot';
import * as d3 from 'd3';

const cars = await d3.csv('https://raw.githubusercontent.com/vega/vega-datasets/master/data/cars.csv', d3.autoType);

const scatter = Plot.plot({
  marks: [
    Plot.dot(cars, {
      x: 'Horsepower',
      y: 'Miles_per_Gallon',
      fill: 'Origin',
      title: 'Name'
    })
  ],
  grid: true,
  color: { legend: true }
});

scatter