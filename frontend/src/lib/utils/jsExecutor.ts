import type { CellOutput } from "../types/notebook";

export class JavaScriptExecutor {
  private outputElement: HTMLElement | null = null;

  constructor() {
    // Create a hidden iframe for safe execution
    this.setupExecutionEnvironment();
  }

  private setupExecutionEnvironment() {
    // Initialize global module cache
    (window as any).__tangent_loadedModules =
      (window as any).__tangent_loadedModules || {};
  }

  async executeCode(code: string): Promise<CellOutput> {
    // If the code contains top-level import/export or top-level await, treat it as a module
    if (/^\s*(import|export)\s+/m.test(code) || /^\s*await\s+/m.test(code)) {
      return this.executeModule(code);
    }
    try {
      // Create a temporary div to capture any DOM outputs
      const outputDiv = document.createElement("div");
      // Keep it visually hidden but present in DOM so libraries can attach SVGs
      outputDiv.style.position = "absolute";
      outputDiv.style.left = "-9999px";
      outputDiv.dataset.tangentOutput = "true";
      document.body.appendChild(outputDiv);

      // Expose to global so external helpers (renderVega) can target it
      (window as any).__tangent_currentOutputDiv = outputDiv;

      // Override console methods to capture output
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;

      let capturedOutput: string[] = [];
      let hasError = false;

      const captureLog = (...args: any[]) => {
        capturedOutput.push(args.map((arg) => this.formatValue(arg)).join(" "));
        originalLog(...args);
      };

      const captureError = (...args: any[]) => {
        capturedOutput.push(
          `ERROR: ${args.map((arg) => this.formatValue(arg)).join(" ")}`,
        );
        hasError = true;
        originalError(...args);
      };

      const captureWarn = (...args: any[]) => {
        capturedOutput.push(
          `WARN: ${args.map((arg) => this.formatValue(arg)).join(" ")}`,
        );
        originalWarn(...args);
      };

      // Temporarily override console methods
      console.log = captureLog;
      console.error = captureError;
      console.warn = captureWarn;

      try {
        // Wrap code to capture the last expression value
        // Split by lines and check if last line is an expression
        const lines = code.trim().split("\n");
        let wrappedCode = code;

        // Check if the last line is likely an expression (not a statement)
        const lastLine = lines[lines.length - 1].trim();
        if (
          lastLine &&
          !lastLine.startsWith("const ") &&
          !lastLine.startsWith("let ") &&
          !lastLine.startsWith("var ") &&
          !lastLine.startsWith("function ") &&
          !lastLine.startsWith("class ") &&
          !lastLine.startsWith("if ") &&
          !lastLine.startsWith("for ") &&
          !lastLine.startsWith("while ") &&
          !lastLine.endsWith("{") &&
          !lastLine.endsWith("}")
        ) {
          // Wrap to return the last expression
          const beforeLast = lines.slice(0, -1).join("\n");
          wrappedCode = `
            ${beforeLast}
            return (${lastLine});
          `;
        }

        const func = new Function(wrappedCode);
        const result = func();

        // Check if the result is a DOM element (HTML or SVG)
        if (result instanceof Node) {
          outputDiv.appendChild(result);
          return {
            type: "html",
            content: outputDiv.innerHTML,
            timestamp: Date.now(),
          };
        }

        // Check if outputDiv has any content
        if (outputDiv.children.length > 0) {
          return {
            type: "html",
            content: outputDiv.innerHTML,
            timestamp: Date.now(),
          };
        }

        // If there's a result value, show it
        if (result !== undefined) {
          capturedOutput.push(this.formatValue(result));
        }

        return {
          type: hasError ? "error" : "text",
          content: capturedOutput.join("\n"),
          timestamp: Date.now(),
        };
      } finally {
        // Restore original console methods
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;

        // Clean up
        try {
          document.body.removeChild(outputDiv);
        } catch {}
        try {
          delete (window as any).__tangent_currentOutputDiv;
        } catch {}
      }
    } catch (error) {
      return {
        type: "error",
        content: `Error: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }

  // Execute code as an ES module so static `import` and top-level `await` work.
  async executeModule(code: string): Promise<CellOutput> {
    try {
      // Ensure global module map exists
      (window as any).__tangent_loadedModules =
        (window as any).__tangent_loadedModules || {};

      // Find import statements to register imported bindings as globals after running the module.
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
          // named imports like {a, b as c}
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

      // Rewrite import specifiers (bare module names) to CDN URLs so the blob module can resolve them
      let rewritten = code;
      try {
        // import ... from 'spec'
        rewritten = rewritten.replace(
          /(import\s+[\s\S]+?\s+from\s+)['"]([^'"]+)['"]/g,
          (m, p1, spec) => {
            const url = this.normalizeModuleUrl(spec);
            return `${p1}'${url}'`;
          },
        );
        // import 'spec'; (side-effect imports)
        rewritten = rewritten.replace(
          /(^|\n)(\s*)import\s+['"]([^'"]+)['"];?/g,
          (m, p1, p2, spec) => {
            const url = this.normalizeModuleUrl(spec);
            return `${p1}${p2}import '${url}';`;
          },
        );
      } catch (e) {
        // If rewriting fails, fall back to original code
        rewritten = code;
      }

      // Append registration code so that imported bindings are stored in window and in module map
      let registrationCode = "\n";
      for (const imp of imports) {
        for (const local of imp.locals) {
          // register by spec string; also set window.<local> so other code can use it
          registrationCode +=
            `try { window.__tangent_loadedModules = window.__tangent_loadedModules || {}; window.__tangent_loadedModules['${imp.spec}'] = window.__tangent_loadedModules['${imp.spec}'] || ${local}; window['${local}'] = ${local}; } catch(e) { console.warn('Failed to register module binding:', e); }\n`;
        }
      }

      // Try to capture the last expression value by wrapping module code
      // Find the last statement and try to export it
      const lines = rewritten.trim().split("\n");
      const lastLine = lines[lines.length - 1].trim();

      // If last line looks like an expression, export it as default
      if (
        lastLine &&
        !lastLine.startsWith("import ") &&
        !lastLine.startsWith("const ") &&
        !lastLine.startsWith("let ") &&
        !lastLine.startsWith("var ") &&
        !lastLine.startsWith("function ") &&
        !lastLine.startsWith("class ") &&
        !lastLine.endsWith("{") &&
        !lastLine.endsWith("}") &&
        !lastLine.endsWith(";")
      ) {
        registrationCode += `\nexport default (${lastLine});\n`;
      }

      const moduleCode = rewritten + registrationCode;

      // Check if all imports are from full URLs (http/https)
      const allImportsAreUrls = imports.every((imp) =>
        imp.spec.startsWith("http://") || imp.spec.startsWith("https://")
      );

      let mod;
      let url;

      try {
        if (allImportsAreUrls) {
          // If all imports are from HTTP/HTTPS URLs, import them directly
          // This avoids blob URL issues with cross-origin module imports

          // Import all modules
          for (const imp of imports) {
            const importedMod = await import(
              /* @vite-ignore */ /* webpackIgnore: true */ imp.spec
            );

            // Register the module globally
            for (const local of imp.locals) {
              (window as any).__tangent_loadedModules =
                (window as any).__tangent_loadedModules || {};
              (window as any).__tangent_loadedModules[imp.spec] = importedMod;
              (window as any)[local] = importedMod.default || importedMod;
            }
          }

          // If there's code after the import, execute it
          const codeAfterImports = code.split("\n").filter((line) =>
            !line.trim().startsWith("import ")
          ).join("\n").trim();

          if (codeAfterImports) {
            // Split code into statements and last expression
            const lines = codeAfterImports.split("\n");
            const lastLine = lines[lines.length - 1].trim();
            const beforeLastLine = lines.slice(0, -1).join("\n");

            // Check if last line is an expression (not a statement)
            const isExpression = lastLine &&
              !lastLine.startsWith("const ") &&
              !lastLine.startsWith("let ") &&
              !lastLine.startsWith("var ") &&
              !lastLine.startsWith("function ") &&
              !lastLine.startsWith("class ") &&
              !lastLine.startsWith("if ") &&
              !lastLine.startsWith("for ") &&
              !lastLine.startsWith("while ");

            // Execute code with last expression captured
            let funcBody = beforeLastLine;
            if (isExpression) {
              funcBody += `\nreturn (${lastLine});`;
            } else {
              funcBody = codeAfterImports; // Execute all as-is
            }

            // Collect all local variable names from all imports
            const allLocals = imports.flatMap((imp) => imp.locals);

            const func = new Function(...allLocals, funcBody);
            const result = func(
              ...allLocals.map((local) => (window as any)[local]),
            );

            // If result is a DOM element, return it as a live element
            if (
              result instanceof Node && result.nodeType === Node.ELEMENT_NODE
            ) {
              return {
                type: "dom",
                content: result as Element,
                timestamp: Date.now(),
              } as any;
            }

            // Otherwise, create a synthetic module with the result as default
            mod = { default: result };
          }
        } else {
          // Use blob URL for complex cases (multiple imports, mixed types, code after imports)
          const blob = new Blob([moduleCode], { type: "text/javascript" });
          url = URL.createObjectURL(blob);

          // Small delay to ensure blob URL is ready
          await new Promise((resolve) => setTimeout(resolve, 10));

          mod = await import(/* @vite-ignore */ /* webpackIgnore: true */ url);
        }

        // Small delay after import
        await new Promise((resolve) => setTimeout(resolve, 10));

        // If module exported something, show it
        const result = mod &&
          (mod.default !== undefined ? mod.default : undefined);

        // Check if result is a DOM node (HTML or SVG element)
        if (result instanceof Node && result.nodeType === Node.ELEMENT_NODE) {
          return {
            type: "dom",
            content: result as Element,
            timestamp: Date.now(),
          } as any;
        }

        // Construct a helpful success message
        const loadedModules = imports.map((imp) => imp.spec).join(", ");
        const message = loadedModules
          ? `Modules loaded: ${loadedModules}`
          : "Module executed successfully";

        return {
          type: "text",
          content: result !== undefined ? this.formatValue(result) : message,
          timestamp: Date.now(),
        };
      } finally {
        // Clean up blob URL after a delay (only if it was created)
        if (url) {
          setTimeout(() => {
            try {
              URL.revokeObjectURL(url);
            } catch {}
          }, 100);
        }
      }
    } catch (error) {
      return {
        type: "error",
        content:
          `Module execution error: ${error.message}\n\nTip: Make sure to use ESM import syntax, e.g.:\nimport * as d3 from 'd3'\nimport { functionName } from 'package-name'`,
        timestamp: Date.now(),
      };
    }
  }

  private formatValue(value: any): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    if (typeof value === "function") return value.toString();
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return value.toString();
      }
    }
    return String(value);
  }

  // Method to load external modules (ESM)
  async loadModule(moduleUrl: string): Promise<any> {
    try {
      const normalizedUrl = this.normalizeModuleUrl(moduleUrl);
      return await import(
        /* @vite-ignore */ /* webpackIgnore: true */ normalizedUrl
      );
    } catch (error) {
      throw new Error(`Failed to load module ${moduleUrl}: ${error.message}`);
    }
  }

  // Normalize module URLs for common patterns
  private normalizeModuleUrl(moduleUrl: string): string {
    // If it's already a full URL, use as-is
    if (moduleUrl.startsWith("http://") || moduleUrl.startsWith("https://")) {
      return moduleUrl;
    }

    // Handle common module patterns with specific versions
    const moduleMap: Record<string, string> = {
      "d3": "https://esm.sh/d3@7",
      "d3@7": "https://esm.sh/d3@7",
      "d3@6": "https://esm.sh/d3@6",
      "@observablehq/plot": "https://esm.sh/@observablehq/plot",
      "plot": "https://esm.sh/@observablehq/plot",
      "lodash": "https://esm.sh/lodash",
      "three": "https://esm.sh/three",
      "p5": "https://esm.sh/p5",
      "chart.js": "https://esm.sh/chart.js",
      "moment": "https://esm.sh/moment",
      "axios": "https://esm.sh/axios",
      "rxjs": "https://esm.sh/rxjs",
      // Data analysis libraries
      "arquero": "https://esm.sh/arquero",
      "vega": "https://esm.sh/vega",
      "vega-lite": "https://esm.sh/vega-lite",
      "vega-embed": "https://esm.sh/vega-embed",
      "plotly.js": "https://esm.sh/plotly.js-dist-min",
      "plotly": "https://esm.sh/plotly.js-dist-min",
      "mathjs": "https://esm.sh/mathjs",
      "math.js": "https://esm.sh/mathjs",
      // Additional useful libraries
      "danfojs": "https://esm.sh/danfojs",
      "simple-statistics": "https://esm.sh/simple-statistics",
      "regression": "https://esm.sh/regression",
    };

    // Check if it's a known module
    if (moduleMap[moduleUrl]) {
      return moduleMap[moduleUrl];
    }

    // Default to esm.sh for npm packages (more reliable than skypack)
    return `https://esm.sh/${moduleUrl}`;
  }

  // Method to make common libraries available globally
  async setupCommonLibraries() {
    // Don't auto-load any libraries - users should import what they need
    // This keeps the notebook clean and explicit
    console.log("JavaScript executor ready");
  }

  // Enhanced code execution with module support
  async executeCodeWithModules(
    code: string,
    modules: string[] = [],
  ): Promise<CellOutput> {
    try {
      // Load any requested modules first
      const modulePromises = modules.map(async (moduleUrl) => {
        const module = await this.loadModule(moduleUrl);
        const moduleName = this.getModuleName(moduleUrl);
        (window as any)[moduleName] = module.default || module;
        return { name: moduleName, module };
      });

      await Promise.all(modulePromises);

      // Execute the code normally
      return await this.executeCode(code);
    } catch (error) {
      return {
        type: "error",
        content: `Module loading error: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }

  private getModuleName(moduleUrl: string): string {
    // Extract a reasonable variable name from the module URL
    if (moduleUrl.includes("d3")) return "d3";
    if (moduleUrl.includes("plot")) return "Plot";
    if (moduleUrl.includes("lodash")) return "_";
    if (moduleUrl.includes("three")) return "THREE";
    if (moduleUrl.includes("p5")) return "p5";

    // Default: extract from URL
    const parts = moduleUrl.split("/");
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/[@\-\.]/g, "_");
  }
}
