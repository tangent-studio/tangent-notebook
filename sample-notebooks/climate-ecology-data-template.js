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

Each dataset comes from `vega-datasets` CDN, providing canonical examples for timeseries, tabular, and categorical analysis. Arquero lets you load csv and json data sets. We first need to fetch the raw data from the URLs and then parse them into Arquero tables. Assign any tables you want to reuse to `globalThis` so later cells can opt into the shared state explicitly.

*/

// %% [javascript]

// trick to load csv and json data via fetch
(async () => {
  const [tempCSV, penguinsJSON] = await Promise.all([
    fetch("https://cdn.jsdelivr.net/npm/vega-datasets@3.2.1/data/global-temp.csv").then(r => r.text()),
    fetch("https://cdn.jsdelivr.net/npm/vega-datasets@3.2.1/data/penguins.json").then(r => r.json())
  ]);

  globalThis.temp = aq.fromCSV(tempCSV);
  globalThis.penguins = aq.fromJSON(penguinsJSON);

})();


// %% [markdown]
/*
## Quick preview tables

Preview the first few rows of each dataset directly in the browser.
*/

// %% [javascript]
globalThis.temp.slice(0, 8);

// %% [javascript]
globalThis.penguins.slice(0, 8);

// %% [markdown]
/*
## Observable Plot visualization

Draw a simple time-series chart of global temperature anomalies with Observable Plot.
*/

// %% [javascript]
Plot.plot({
  marks: [
    Plot.ruleY([0], { stroke: "#aaaaaa" }),
    Plot.line(globalThis.temp, {
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
Plot.dot(globalThis.penguins, {x: "Flipper Length (mm)", y: "Body Mass (g)", fill: "Species"}).plot({ grid: true })