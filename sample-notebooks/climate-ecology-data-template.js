// ---
// title: Climate and Ecology Data Exploration Template
// id: climate-ecology-data-template
// ---

// %% [markdown]
/*

This lightweight JavaScript notebook combines **Arquero** and **Observable Plot**. This template sets up a consistent structure for reproducible data exploration and narrative analysis.

It uses public datasets:
- Global temperature anomalies
- Palmer Penguins morphology data

*/

// %% [javascript]
import * as aq from "arquero";
import * as Plot from "@observablehq/plot";

// %% [markdown]
/*
## Load datasets with Arquero

Each dataset comes from `vega-datasets` CDN, providing canonical examples for timeseries, tabular, and categorical analysis. Arquero lets you load csv and json data sets. We first need to fetch the raw data from the URLs and then parse them into Arquero tables. Variables declared with `let` or `const` won't cross the cells. Variables declared without `const` or `let` will be global and reusable between cells - or you can use `globalThis.variableName` to be explicit.

*/

// %% [javascript]
temp = aq.fromCSV(await fetch("https://cdn.jsdelivr.net/npm/vega-datasets@3.2.1/data/global-temp.csv").then(r => r.text()));
penguins = aq.fromJSON(await fetch("https://cdn.jsdelivr.net/npm/vega-datasets@3.2.1/data/penguins.json").then(r => r.json()));

// %% [markdown]
/*
## Quick preview tables

Preview the first few rows of each dataset directly in the browser.
*/

// %% [javascript]
temp.slice(0, 8);

// %% [javascript]
penguins.sample(8);

// %% [markdown]
/*
## Observable Plot visualization

Draw a simple time-series chart of global temperature anomalies with Observable Plot.
*/

// %% [javascript]
Plot.plot({
  marks: [
    Plot.ruleY([0], { stroke: "#aaaaaa" }),
    Plot.line(temp, {
      x: "year",
      y: "temp"
    }),
  ],
});

// %% [markdown]
/*
Draw a relation between flipper length and body mass of penguins.
*/

// %% [javascript]
Plot.dot(penguins, {x: "Flipper Length (mm)", y: "Body Mass (g)", fill: "Species"}).plot({ grid: true })