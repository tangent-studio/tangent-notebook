// ---
// title: Data Visualization with D3 and Observable Plot
// id: data-visualization-d3-observable-plot
// ---

// %% [markdown]
/*
# Data Visualization with D3 and Observable Plot

This notebook demonstrates how to use D3.js and Observable Plot for interactive data visualization in Tangent Notebook.

- Load CSV data from a remote URL
- Visualize trends with Observable Plot
- Explore data with D3

*/

// %% [markdown]
/*
## Observable Plot

Plot provides a simpler API for common charts:
*/

// %% [javascript]
import * as d3 from "d3";
import * as Plot from "@observablehq/plot";


// %% [javascript]
const plotData = [
  { category: "A", value: 23 },
  { category: "B", value: 45 },
  { category: "C", value: 12 },
  { category: "D", value: 67 },
  { category: "E", value: 34 },
];

const chart = Plot.plot({
  marks: [
    Plot.barY(plotData, { x: "category", y: "value", fill: "steelblue" }),
  ],
  y: { grid: true },
  marginBottom: 40,
});

chart;

// %% [markdown]
/*
## Loading CSV Data

Use D3 to fetch and parse CSV files:
*/

// %% [javascript]
const co2 = await d3.csv(
  "https://cdn.jsdelivr.net/npm/vega-datasets@3.2.1/data/global-temp.csv",
);
co2 = co2.map((d) => ({ year: +d.year, temp: +d.temp }));

globalThis.co2 = co2;

// Show first 5 rows
co2.slice(0, 5);

// %% [markdown]
/*
## Scatter Plot with Real Data
*/

// %% [javascript]
const temp_trend = Plot.plot({
  marks: [
    Plot.line(globalThis.co2, {
      x: "year",
      y: "temp",
    }),
  ],
  grid: true,
  color: { legend: true },
});

temp_trend;
