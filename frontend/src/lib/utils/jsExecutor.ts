/**
 * tangent-notebook_/frontend/src/lib/utils/jsExecutor.ts
 *
 * JavaScript executor used by Tangent Notebook frontend.
 *
 * Responsibilities:
 * - Execute non-module JS code in a global-like context so top-level declarations
 *   can persist between notebook cells.
 * - Route code that contains top-level `import`/`export` to module execution to
 *   avoid syntax errors (import declarations only valid at module top-level),
 *   while allowing top-level await within regular cells.
 * - Capture console output and collect DOM outputs appended to a temporary output div.
 * - Heuristically expose top-level `const|let|var name = ...` as `window.name = ...`
 *   so subsequent cells can access the same objects.
 * - Avoid printing huge structures when the last line is an assignment to `window`/`globalThis`.
 *
 * Note: This file intentionally uses pragmatic, regex-based heuristics for the notebook use-case.
 * For full correctness and edge-case handling, consider a proper JS parser/AST transformations.
 */

import type { CellOutput } from "../types/notebook";

export class JavaScriptExecutor {
  private outputElement: HTMLElement | null = null;

  constructor() {
    this.setupExecutionEnvironment();
  }

  private setupExecutionEnvironment() {
    (window as any).__tangent_loadedModules =
      (window as any).__tangent_loadedModules || {};
  }

  /**
   * Execute a code cell that is not treated as an ESM module.
   * If the code contains top-level import/export it will be
   * delegated to executeModule to avoid `import` syntax errors.
   */
  async executeCode(code: string): Promise<CellOutput> {
    // If code contains top-level import/export, route to module execution.
    // This prevents "import declarations may only appear at top level of a module".
    if (/^\s*(import|export)\s+/m.test(code)) {
      return this.executeModule(code);
    }

    try {
      if (!code || !code.trim()) {
        return {
          type: "text",
          content: "No code to execute",
          timestamp: Date.now(),
        };
      }

      // Temporary DOM container to capture library-attached visualizations
      const outputDiv = document.createElement("div");
      outputDiv.style.position = "absolute";
      outputDiv.style.left = "-9999px";
      outputDiv.dataset.tangentOutput = "true";
      document.body.appendChild(outputDiv);
      (window as any).__tangent_currentOutputDiv = outputDiv;

      // Capture console output
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;

      let capturedOutput: string[] = [];
      let hasError = false;

      const captureLog = (...args: any[]) => {
        capturedOutput.push(args.map((a) => this.formatValue(a)).join(" "));
        originalLog(...args);
      };
      const captureError = (...args: any[]) => {
        capturedOutput.push(
          `ERROR: ${args.map((a) => this.formatValue(a)).join(" ")}`,
        );
        hasError = true;
        originalError(...args);
      };
      const captureWarn = (...args: any[]) => {
        capturedOutput.push(
          `WARN: ${args.map((a) => this.formatValue(a)).join(" ")}`,
        );
        originalWarn(...args);
      };

      console.log = captureLog;
      console.error = captureError;
      console.warn = captureWarn;

      try {
        // Split into lines, detect simple top-level declarations and promote them to window.<name>
        const lines = code.split("\n");

        // Collect declared top-level simple identifiers (heuristic)
        const declaredNames: string[] = [];
        const varDeclRegex =
          /(^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)(?:\s*=)?/g;
        let varMatch: RegExpExecArray | null;
        while ((varMatch = varDeclRegex.exec(code)) !== null) {
          declaredNames.push(varMatch[2]);
        }

        // Transform top-level declarations into window.<name> = ...
        const transformed = code.replace(
          /(^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
          (_, p1, p2) => `${p1}window.${p2} = `,
        );
        const transformedLines = transformed.split("\n");

        // Detect if last line is a simple expression we should display
        const rawLastLine = lines[lines.length - 1]?.trim() ?? "";
        const lastNoSemi = rawLastLine.replace(/;+$/, "");
        // treat as expression if it doesn't start with a statement keyword and isn't an assignment
        const isLikelyExpression = lastNoSemi &&
          !/^(const|let|var|function|class|if|for|while|switch|return)\b/.test(
            lastNoSemi,
          ) &&
          !lastNoSemi.endsWith("{") &&
          !lastNoSemi.endsWith("}") &&
          // avoid plain assignments (a = b, obj.prop = ...)
          !/^[\s\S]*=[^=][\s\S]*$/.test(lastNoSemi);

        let execBody = transformed;
        if (isLikelyExpression) {
          const transformedBefore = transformedLines.slice(0, -1).join("\n");
          const identMatch = /^[A-Za-z_$][\w$]*$/.test(lastNoSemi)
            ? lastNoSemi
            : null;

          if (identMatch && declaredNames.includes(identMatch)) {
            // if the last expression is a promoted identifier, read the window-backed value
            execBody = transformedBefore.trim()
              ? `${transformedBefore}\nwindow.__tangent_last = window.${identMatch};`
              : `window.__tangent_last = window.${identMatch};`;
          } else {
            // evaluate the expression and store in __tangent_last
            execBody = transformedBefore.trim()
              ? `${transformedBefore}\nwindow.__tangent_last = (${lastNoSemi});`
              : `window.__tangent_last = (${lastNoSemi});`;
          }
        } else {
          // Not an expression — do nothing special, run transformed code as-is.
          // This covers declarations, assignments, etc.
          execBody = transformed;
        }

        // Export any top-level function/class declarations to window so later cells can use them
        const funcNames: string[] = [];
        const funcRegex = /(^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g;
        let fm: RegExpExecArray | null;
        while ((fm = funcRegex.exec(code)) !== null) {
          funcNames.push(fm[2]);
        }
        const classNames: string[] = [];
        const classRegex = /(^|\n)\s*class\s+([A-Za-z_$][\w$]*)\s*/g;
        let cm: RegExpExecArray | null;
        while ((cm = classRegex.exec(code)) !== null) {
          classNames.push(cm[2]);
        }
        if (funcNames.length || classNames.length) {
          const exports = [...funcNames, ...classNames]
            .map((n) => `window.${n} = ${n};`)
            .join("\n");
          execBody = `${execBody}\n${exports}`;
        }

        // Execute in global scope using indirect eval so window assignments persist.
        const globalEval = (0, eval) as (s: string) => any;
        const wrapped = `(async () => {\n${execBody}\n})()`;
        const result = globalEval(wrapped);
        if (result && typeof result.then === "function") {
          await result;
        }

        // After execution, prefer DOM outputs that libraries appended to the outputDiv
        const lastVal = (window as any).__tangent_last;
        try {
          delete (window as any).__tangent_last;
        } catch {
          // ignore
        }

        if (lastVal instanceof Node) {
          // Return the DOM node directly so the renderer can insert it live.
          return {
            type: "dom",
            content: lastVal as Element,
            timestamp: Date.now(),
          };
        }

        const tableFromSpecial = this.tryRenderTable(lastVal);
        if (tableFromSpecial) {
          return {
            type: "dom",
            content: tableFromSpecial,
            timestamp: Date.now(),
          };
        }

        if (outputDiv.children.length > 0) {
          // a library attached visualization - detach children and return as a live DOM node.
          // If there is a single root element, return it; otherwise wrap children in a container div.
          let domNode: Element;
          if (outputDiv.children.length === 1) {
            domNode = outputDiv.children[0] as Element;
          } else {
            const wrapper = document.createElement("div");
            while (outputDiv.firstChild) {
              wrapper.appendChild(outputDiv.firstChild);
            }
            domNode = wrapper;
          }
          return {
            type: "dom",
            content: domNode,
            timestamp: Date.now(),
          };
        }

        // If we captured a last expression value, show it (formatted)
        if (lastVal !== undefined) {
          return {
            type: hasError ? "error" : "text",
            content: capturedOutput.concat([this.formatValue(lastVal)]).join(
              "\n",
            ),
            timestamp: Date.now(),
          };
        }

        // Otherwise, show captured console output (if any)
        return {
          type: hasError ? "error" : "text",
          content: capturedOutput.join("\n"),
          timestamp: Date.now(),
        };
      } finally {
        // restore console
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;

        // cleanup temporary outputDiv
        try {
          const cur = (window as any).__tangent_currentOutputDiv;
          if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
        } catch {}
        try {
          if (outputDiv.parentNode) outputDiv.parentNode.removeChild(outputDiv);
        } catch {}
        try {
          delete (window as any).__tangent_currentOutputDiv;
        } catch {}
      }
    } catch (error: any) {
      return {
        type: "error",
        content: `Error: ${error?.message ?? String(error)}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Execute code as an ES module. Supports static imports and top-level await.
   * Strategy:
   * - Parse import statements (simple regex) and dynamic-import those modules via CDN if needed.
   * - Remove import lines and execute the remaining code inside an async IIFE via indirect eval
   *   after transforming top-level declarations into window.* assignments so they persist.
   * - Capture a final expression similarly to executeCode by writing into window.__tangent_last.
   */
  async executeModule(code: string): Promise<CellOutput> {
    try {
      (window as any).__tangent_loadedModules =
        (window as any).__tangent_loadedModules || {};

      // Find import statements (simple regex - supports common forms)
      const imports: Array<{ spec: string; locals: string[] }> = [];
      const importRegex =
        /import\s+(?:\*\s+as\s+([\w_$]+)|([\w_$]+)|\{([^}]+)\})\s+from\s+['"]([^'"]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = importRegex.exec(code)) !== null) {
        const localAll = m[1];
        const localDefault = m[2];
        const localNamed = m[3];
        const spec = m[4];
        const locals: string[] = [];
        if (localAll) locals.push(localAll);
        if (localDefault) locals.push(localDefault);
        if (localNamed) {
          localNamed.split(",").forEach((part) => {
            const asMatch = part.trim().match(/([\w_$]+)\s+as\s+([\w_$]+)/);
            if (asMatch) locals.push(asMatch[2]);
            else {
              const name = part.trim();
              if (name) locals.push(name);
            }
          });
        }
        if (locals.length > 0) imports.push({ spec, locals });
      }

      // Load modules and expose to window under reasonable names
      for (const imp of imports) {
        const url = this.normalizeModuleUrl(imp.spec);
        const mod = await import(
          /* @vite-ignore */ /* webpackIgnore: true */ url
        );
        for (const local of imp.locals) {
          (window as any)[local] = mod.default || mod;
        }
        (window as any).__tangent_loadedModules[imp.spec] = mod;
      }

      // Remove import lines from code and trim
      const codeWithoutImports = code
        .split("\n")
        .filter((line) => !line.trim().startsWith("import "))
        .join("\n")
        .trim();

      if (!codeWithoutImports) {
        const loadedModules = imports.map((i) => i.spec).join(", ");
        return {
          type: "text",
          content: loadedModules
            ? `Modules loaded: ${loadedModules}`
            : "No code",
          timestamp: Date.now(),
        };
      }

      // Find declared top-level vars to bind after execution
      const declaredVars: string[] = [];
      const varDeclRegex =
        /(^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g;
      let vm: RegExpExecArray | null;
      while ((vm = varDeclRegex.exec(codeWithoutImports)) !== null) {
        declaredVars.push(vm[2]);
      }

      // Transform top-level declarations into window.<name> = ...
      const transformed = codeWithoutImports.replace(
        /(^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm,
        (_, p1, p2) => `${p1}window.${p2} = `,
      );

      // Determine if last line is an expression we should capture
      const lines = codeWithoutImports.split("\n");
      const rawLast = lines[lines.length - 1]?.trim() ?? "";
      const lastNoSemi = rawLast.replace(/;+$/, "");
      const isLastExpr = lastNoSemi &&
        !/^(const|let|var|function|class|if|for|while|switch|return)\b/.test(
          lastNoSemi,
        ) &&
        !lastNoSemi.endsWith("{") &&
        !lastNoSemi.endsWith("}") &&
        !/^(?:globalThis|window)\s*(?:\.|\[).*=/.test(lastNoSemi);

      let funcBody: string;
      if (isLastExpr) {
        const identMatch = /^[A-Za-z_$][\w$]*$/.test(lastNoSemi)
          ? lastNoSemi
          : null;
        if (identMatch && declaredVars.includes(identMatch)) {
          const transformedBeforeLast = transformed.split("\n").slice(0, -1)
            .join("\n");
          funcBody =
            `${transformedBeforeLast}\nwindow.__tangent_last = window.${identMatch};`;
        } else {
          const transformedBeforeLast = transformed.split("\n").slice(0, -1)
            .join("\n");
          funcBody =
            `${transformedBeforeLast}\nwindow.__tangent_last = (${lastNoSemi});`;
        }
      } else {
        funcBody = transformed;
      }

      // Execute the code inside an async IIFE in global scope so window assignments persist
      const asyncIIFE = `(async () => {\n${funcBody}\n})()`;
      const globalEval = (0, eval) as (s: string) => any;
      await globalEval(asyncIIFE);

      // Create bare var bindings for declared vars so subsequent cells can reference them by name
      if (declaredVars.length > 0) {
        const bindCode = declaredVars.map((n) => `var ${n} = window.${n};`)
          .join("\n");
        try {
          globalEval(bindCode);
        } catch {
          // ignore
        }
      }

      // Return last captured value if present
      const last = (window as any).__tangent_last;
      try {
        delete (window as any).__tangent_last;
      } catch {}

      if (last instanceof Node) {
        return {
          type: "dom",
          content: last as Element,
          timestamp: Date.now(),
        } as any;
      }

      const tableFromSpecial = this.tryRenderTable(last);
      if (tableFromSpecial) {
        return {
          type: "dom",
          content: tableFromSpecial,
          timestamp: Date.now(),
        };
      }

      return {
        type: "text",
        content: last !== undefined ? this.formatValue(last) : "Executed",
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        type: "error",
        content: `Module execution error: ${err?.message ?? String(err)}`,
        timestamp: Date.now(),
      };
    }
  }

  // Small helper to format values for display. Avoids dumping extremely large arrays fully.
  private formatValue(value: any): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    if (typeof value === "function") return value.toString();
    if (typeof value === "object") {
      try {
        if (Array.isArray(value) && value.length > 200) {
          return `Array(${value.length}) [${
            value
              .slice(0, 10)
              .map((v: any) => this.formatValue(v))
              .join(", ")
          } ...]`;
        }
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  // Load ESM module via dynamic import and return it
  async loadModule(moduleUrl: string): Promise<any> {
    try {
      const normalized = this.normalizeModuleUrl(moduleUrl);
      return await import(
        /* @vite-ignore */ /* webpackIgnore: true */ normalized
      );
    } catch (err: any) {
      throw new Error(
        `Failed to load module ${moduleUrl}: ${err?.message ?? String(err)}`,
      );
    }
  }

  private normalizeModuleUrl(moduleUrl: string): string {
    if (/^https?:\/\//.test(moduleUrl)) return moduleUrl;
    // default to jsdelivr +esm entry
    return `https://cdn.jsdelivr.net/npm/${moduleUrl}/+esm`;
  }

  private tryRenderTable(value: any): Element | null {
    if (!value || typeof value !== "object") return null;

    const looksLikeTable = typeof (value as any).objects === "function" &&
      typeof (value as any).columnNames === "function" &&
      typeof (value as any).numRows === "function";
    if (!looksLikeTable) return null;

    let rows: any[] | null = null;
    try {
      if (typeof value.objects === "function") {
        const result = value.objects();
        if (Array.isArray(result)) {
          rows = result;
        } else if (result && typeof result[Symbol.iterator] === "function") {
          rows = Array.from(result);
        }
      }
    } catch {
      rows = null;
    }

    if (!Array.isArray(rows) || rows.length === 0) return null;
    if (rows.length > 1000) rows = rows.slice(0, 1000);

    let keys: string[] = [];
    try {
      const cols = value.columnNames();
      if (Array.isArray(cols)) keys = cols.slice(0, 100);
    } catch {
      keys = [];
    }

    if (!keys.length) {
      const set = new Set<string>();
      rows.forEach((row) => {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          Object.keys(row).forEach((k) => set.add(k));
        }
      });
      keys = Array.from(set);
    }

    if (keys.length === 0 || keys.length > 100) return null;

    // Ensure each row is an object keyed by column name
    rows = rows.map((row) => {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        return row;
      }
      const obj: Record<string, any> = {};
      keys.forEach((key, idx) => {
        if (Array.isArray(row)) obj[key] = row[idx];
        else obj[key] = undefined;
      });
      return obj;
    });

    const table = document.createElement("table");
    table.className = "tangent-table-output";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    keys.forEach((key) => {
      const th = document.createElement("th");
      th.textContent = key;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.slice(0, 500).forEach((row) => {
      const tr = document.createElement("tr");
      keys.forEach((key) => {
        const td = document.createElement("td");
        const value = (row as any)[key];
        td.textContent =
          value === null || value === undefined ? "" : String(value);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  /**
   * setupCommonLibraries
   *
   * Compatibility shim called by the UI at startup. Kept intentionally lightweight:
   * - No-op by default so existing behaviour doesn't change.
   * - Provides a single place to eagerly load or expose commonly used libraries in future.
   */
  async setupCommonLibraries(): Promise<void> {
    // Preload common libraries used by sample notebooks so cells can rely on
    // `window.d3` and `window.Plot` without each cell importing them.
    // This uses the existing `loadModule` helper which normalizes module URLs
    // to a CDN +esm entry, and exposes the modules' default export (or module)
    // on the window object.
    try {
      if ((window as any).__tangent_commonLibsLoaded) return;

      const [d3mod, plotmod] = await Promise.all([
        this.loadModule("d3"),
        this.loadModule("@observablehq/plot"),
      ]);

      (window as any).d3 = d3mod && (d3mod.default || d3mod);
      (window as any).Plot = plotmod && (plotmod.default || plotmod);

      (window as any).__tangent_commonLibsLoaded = true;
    } catch (err) {
      // Non-fatal: if loading fails, cells can still use dynamic import or fall back.
      // Log a warning to aid debugging in the browser console.
      try {
        console.warn(
          "setupCommonLibraries: failed to preload common libs",
          err,
        );
      } catch {}
    }
  }

  // Convenience: load modules first and then execute a code string in non-module path
  async executeCodeWithModules(
    code: string,
    modules: string[] = [],
  ): Promise<CellOutput> {
    try {
      await Promise.all(
        modules.map(async (m) => {
          const mod = await this.loadModule(m);
          const name = this.getModuleName(m);
          (window as any)[name] = mod.default || mod;
        }),
      );
      return await this.executeCode(code);
    } catch (err: any) {
      return {
        type: "error",
        content: `Module loading error: ${err?.message ?? String(err)}`,
        timestamp: Date.now(),
      };
    }
  }

  private getModuleName(moduleUrl: string): string {
    if (moduleUrl.includes("d3")) return "d3";
    if (moduleUrl.includes("plot")) return "Plot";
    if (moduleUrl.includes("lodash")) return "_";
    if (moduleUrl.includes("three")) return "THREE";
    if (moduleUrl.includes("p5")) return "p5";
    const parts = moduleUrl.split("/");
    const last = parts[parts.length - 1];
    return last.replace(/[@\-\.]/g, "_");
  }
}
