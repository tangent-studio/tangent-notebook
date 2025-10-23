<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import loader from '@monaco-editor/loader';
  import { aiService } from '../utils/aiService';

  export let value: string = '';
  export let language: string = 'javascript';
  export let theme: string = 'vs';
  export let height: string = '200px';
  export let readOnly: boolean = false;

  const dispatch = createEventDispatcher();

  let container: HTMLDivElement;
  let editor: any;
  let monacoLib: any;
  let editorHeight = '32px';
  let focusDisposable: { dispose: () => void } | null = null;
  let blurDisposable: { dispose: () => void } | null = null;
  let removePointerListener: (() => void) | null = null;
  let contentSizeDisposable: { dispose: () => void } | null = null;
  const MIN_HEIGHT = 20;
  const MAX_HEIGHT = 700;
  const HEIGHT_PADDING = 6;

  function scheduleHeightSync(delays: number[] = [0, 80, 200, 400]) {
    if (height !== 'auto') return;
    delays.forEach((delay) => {
      setTimeout(() => {
        if (!editor) return;
        try {
          applyEditorHeight(calculatePreferredHeight());
          editor.layout();
        } catch {
          // ignore measurement failures
        }
      }, delay);
    });
  }

  function calculatePreferredHeight(): number {
    try {
      if (!editor) return MIN_HEIGHT;
      const model = editor.getModel ? editor.getModel() : null;
      const lineCount = model && typeof model.getLineCount === 'function'
        ? Math.max(model.getLineCount(), 1)
        : 1;

      let lineHeight = editor.getConfiguration?.().lineHeight;
      if ((!lineHeight || !Number.isFinite(lineHeight)) && monacoLib?.editor?.EditorOption !== undefined) {
        try {
          const optionKey = monacoLib.editor.EditorOption.lineHeight;
          lineHeight = editor.getOption?.(optionKey) || lineHeight;
        } catch (_) {
          /* ignore */
        }
      }
      if (!lineHeight || !Number.isFinite(lineHeight)) {
        lineHeight = 20;
      }

      const estimated = (lineCount + 1) * lineHeight;
      return Math.max(estimated, MIN_HEIGHT);
    } catch (_) {
      return MIN_HEIGHT;
    }
  }

  function applyEditorHeight(px: number) {
    const padded = Math.max(0, px) + HEIGHT_PADDING;
    const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(padded)));
    editorHeight = `${clamped}px`;
  }

  function patchCaretRangeFallback(doc: Document | null | undefined) {
    if (!doc) return;
    const anyDoc = doc as any;
    if (anyDoc.__tangentPatchedCaretRange) return;

    const originalCaretRange = typeof anyDoc.caretRangeFromPoint === 'function'
      ? anyDoc.caretRangeFromPoint.bind(doc)
      : null;
    const originalCaretPosition = typeof anyDoc.caretPositionFromPoint === 'function'
      ? anyDoc.caretPositionFromPoint.bind(doc)
      : null;

    if (!originalCaretRange && !originalCaretPosition) return;

    anyDoc.__tangentPatchedCaretRange = true;
    anyDoc.caretRangeFromPoint = (x: number, y: number) => {
      try {
        if (originalCaretRange) {
          const range = originalCaretRange(x, y);
          if (range) return range;
        }
        if (originalCaretPosition) {
          const pos = originalCaretPosition(x, y);
          if (pos && pos.offsetNode) {
            const synthetic = doc.createRange();
            synthetic.setStart(pos.offsetNode, pos.offset ?? 0);
            synthetic.collapse(true);
            return synthetic;
          }
        }
        if (doc.body) {
          const synthetic = doc.createRange();
          synthetic.setStart(doc.body, 0);
          synthetic.collapse(true);
          return synthetic;
        }
      } catch {
        // ignore and fall through
      }
      return null;
    };
  }

  $: computedHeight = height === 'auto' ? editorHeight : height;

  onMount(async () => {
    // Initialize Monaco via loader which configures workers correctly for bundlers like Vite
    monacoLib = await loader.init();

    patchCaretRangeFallback(container?.ownerDocument ?? document);

    // Helper: wait until the editor container is actually visible in layout.
    // Monaco's hit-testing can fail with null nodes when created in hidden/offscreen containers
    // (for example inside a collapsed sidebar). We poll via requestAnimationFrame until the
    // container has a non-zero layout rect and is connected.
    async function waitForContainerVisible(el: HTMLElement | undefined | null, timeout = 3000) {
      if (!el) return;
      const start = performance.now();
      return new Promise<void>((resolve) => {
        const check = () => {
          try {
            if (
              el &&
              el.isConnected &&
              el.offsetParent !== null &&
              el.getBoundingClientRect &&
              el.getBoundingClientRect().width > 0 &&
              el.getBoundingClientRect().height > 0
            ) {
              resolve();
              return;
            }
            if (performance.now() - start > timeout) {
              // timeout: resolve anyway to avoid blocking; Monaco will still attempt to create
              resolve();
              return;
            }
          } catch {
            // ignore exceptions and retry
          }
          requestAnimationFrame(check);
        };
        check();
      });
    }

    // Configure Monaco Editor
    if (monacoLib.languages && monacoLib.languages.typescript) {
      monacoLib.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monacoLib.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monacoLib.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monacoLib.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monacoLib.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ['node_modules/@types']
      });

      // Add common type definitions
      monacoLib.languages.typescript.javascriptDefaults.addExtraLib(`
        declare const d3: any;
        declare const Plot: any;
        declare const console: {
          log(...args: any[]): void;
          error(...args: any[]): void;
          warn(...args: any[]): void;
        };
      `, 'global.d.ts');
    }

    // Wait for the container to be laid out to reduce chance of hitTest null errors
    await waitForContainerVisible(container);

    // Create editor (guard with try/catch to log unexpected failures)
    try {
      editor = monacoLib.editor.create(container, {
        value,
        language,
        theme,
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 4,
        automaticLayout: true,
        fontSize: 12,
        fontFamily: '"Fira Code", Monaco, Menlo, "Ubuntu Mono", monospace',
        tabSize: 2,
        insertSpaces: true,
        contextmenu: true,
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        acceptSuggestionOnCommitCharacter: true,
        snippetSuggestions: 'top',
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          useShadows: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          alwaysConsumeMouseWheel: false
        },
        padding: {
          top: 4,
          bottom: 4
        }
      });

      // Ensure layout is correct immediately after creation and when the container resizes
      try {
        // small defer to let layout settle
        setTimeout(() => {
          try { editor.layout(); } catch {}
        }, 0);

        // Use a ResizeObserver on the container to trigger layout when size changes
        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(() => {
            try { editor.layout(); } catch {}
          });
          ro.observe(container);
        } else {
          // Fallback to window resize event
          const onWinResize = () => {
            try { editor.layout(); } catch {}
          };
          window.addEventListener('resize', onWinResize);
        }
      } catch (e) {
        // no-op if layout helpers fail
      }

      // Update height on content change
      editor.onDidChangeModelContent(() => {
        const newValue = editor.getValue();
        if (newValue !== value) {
          value = newValue;
          dispatch('change', { value: newValue });
        }

        // Update height based on content
        if (height === 'auto') scheduleHeightSync([0, 80, 200]);
      });

      contentSizeDisposable = editor.onDidContentSizeChange((e: any) => {
        if (height === 'auto') scheduleHeightSync([0, 120]);
      });

      // Initial height calculation
      if (height === 'auto') {
        const syncHeights = () => {
          applyEditorHeight(calculatePreferredHeight());
          editor.layout();
        };
        syncHeights();
        [80, 200, 400].forEach(delay => setTimeout(syncHeights, delay));
      }

      // Add a DOM-level keydown listener in capture phase to ensure shortcuts
      // are handled even when Monaco internals consume events.
      const domKeyHandler = (e: KeyboardEvent) => {
        // Shift+Enter: Run and move to next cell
        if (e.shiftKey && e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          dispatch('runAndAdvance');
        }
        // Ctrl/Cmd+Enter: Just run the cell
        else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          dispatch('run');
        }
      };

      // Use capture so we see events before Monaco may stop propagation
      container.addEventListener('keydown', domKeyHandler, true);

      const forwardFocus = () => {
        dispatch('editorFocus');
        dispatch('focus');
      };
      try {
        focusDisposable = editor.onDidFocusEditorWidget(forwardFocus);
        blurDisposable = editor.onDidBlurEditorWidget(() => {
          dispatch('editorBlur');
          dispatch('blur');
        });
      } catch {
        focusDisposable = null;
        blurDisposable = null;
      }

      const pointerHandler = () => {
        try {
          editor?.focus();
        } catch {
          // best-effort focus
        }
        forwardFocus();
      };
      const pointerOptions: AddEventListenerOptions = { capture: true };
      container.addEventListener('pointerdown', pointerHandler, pointerOptions);
      removePointerListener = () => {
        try {
          container.removeEventListener('pointerdown', pointerHandler, pointerOptions);
        } catch {
          // ignore cleanup failure
        }
      };

      // Add AI code completion shortcuts
      editor.addCommand(monacoLib.KeyMod.CtrlCmd | monacoLib.KeyCode.Space, () => {
        triggerAICompletion();
      });

      editor.addCommand(monacoLib.KeyMod.CtrlCmd | monacoLib.KeyMod.Shift | monacoLib.KeyCode.KeyG, () => {
        triggerAIGeneration();
      });

      // Register AI completion provider
      registerAICompletionProvider();

      // Focus the editor
      try { editor.focus(); } catch {}
    } catch (err) {
      // If editor creation fails, surface a console warning but do not crash the app.
      try {
        console.warn('Monaco editor creation failed:', err);
      } catch {}
    }
  });

  // AI completion functions
  async function triggerAICompletion() {
    if (!editor || !aiService.isConfigured() || !monacoLib) return;

    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return;

    try {
      const code = model.getValue();
      const offset = model.getOffsetAt(position);

      const completion = await aiService.getCodeCompletion({
        code,
        cursor: offset,
        language: 'javascript'
      });

      if (completion.completions.length > 0) {
        const suggestion = completion.completions[0];
        editor.executeEdits('ai-completion', [{
    range: new monacoLib.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: suggestion
        }]);
      }
    } catch (error) {
      console.error('AI completion failed:', error);
    }
  }

  async function triggerAIGeneration() {
     if (!editor || !aiService.isConfigured()) return;

    const selection = editor.getSelection();
    const model = editor.getModel();
    if (!model || !selection) return;

    const selectedText = model.getValueInRange(selection);
    const userPrompt = selectedText || window.prompt('Enter a description of the code you want to generate:');

    if (!userPrompt) return;

    try {
      const generation = await aiService.generateCode({
        prompt: userPrompt,
        language: 'javascript'
      });

      if (generation.code) {
        editor.executeEdits('ai-generation', [{
          range: selection,
          text: generation.code
        }]);
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      alert(`AI generation failed: ${error.message}`);
    }
  }

  function registerAICompletionProvider() {
    if (!aiService.isConfigured() || !monacoLib) return;

    monacoLib.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: async (model, position) => {
        try {
          const code = model.getValue();
          const offset = model.getOffsetAt(position);

          const completion = await aiService.getCodeCompletion({
            code,
            cursor: offset,
            language: 'javascript'
          });

          return {
            suggestions: completion.completions.map((text, index) => ({
              label: `AI: ${text.substring(0, 50)}...`,
              kind: monacoLib.languages.CompletionItemKind.Snippet,
              insertText: text,
              documentation: 'AI-generated completion',
              sortText: `0${index}` // Prioritize AI suggestions
            }))
          };
        } catch (error) {
          console.error('AI completion provider failed:', error);
          return { suggestions: [] };
        }
      }
    });
  }

  onDestroy(() => {
    if (editor) {
      editor.dispose();
    }
    try {
      focusDisposable?.dispose();
    } catch {}
    try {
      blurDisposable?.dispose();
    } catch {}
    try {
      removePointerListener?.();
    } catch {}
    try {
      contentSizeDisposable?.dispose();
    } catch {}
  });

  // Update editor value when prop changes
  $: if (editor && value !== editor.getValue()) {
    editor.setValue(value);
    if (height === 'auto') {
      setTimeout(() => {
        applyEditorHeight(calculatePreferredHeight());
        editor.layout();
      }, 0);
    }
  }

  // Update editor theme when prop changes
  $: if (editor && theme && monacoLib) {
    monacoLib.editor.setTheme(theme);
  }

  // Update editor language when prop changes
  $: if (editor && language && monacoLib) {
    const model = editor.getModel();
    if (model) {
      monacoLib.editor.setModelLanguage(model, language);
    }
  }

  export function focus() {
    if (editor) {
      editor.focus();
    }
  }

  export function getEditor() {
    return editor;
  }
</script>

<div bind:this={container} class="monaco-editor-container" tabindex="0" role="textbox" style="height: {computedHeight}; width: 100%;"></div>

<style>
  .monaco-editor-container {
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    min-height: 20px;
    transition: height 0.1s ease;
  }
  :global(.monaco-editor) {
    border-radius: 0.375rem;
  }

  /* Increase spacing between line numbers and code */
  :global(.monaco-editor .margin) {
    padding-right: 16px !important;
    background: transparent;
  }

  :global(.monaco-editor .line-numbers) {
    padding-right: 12px !important;
  }
</style>
