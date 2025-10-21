# Tangent Notebook File Format

## Overview

Tangent Notebook uses a **text-based format** inspired by Jupytext, making notebooks easy to read, edit, and version control with Git.

## File Extension

Notebooks are saved with a `.js` extension to leverage syntax highlighting in most editors.

## Format Structure

### Header (Optional)

```javascript
// ---
// title: My Notebook
// id: notebook-unique-id
// ---
```

The header contains metadata:
- `title`: Human-readable notebook name
- `id`: Unique identifier for the notebook

### Cell Delimiters

Cells are separated using special comment markers:

#### Code Cells

```javascript
// %% [javascript]

const x = 42;
console.log(x);
```

#### Markdown Cells

```javascript
// %% [markdown]
/*
# My Heading

This is markdown content.
You can use **bold**, *italic*, and `code`.

## Lists

- Item 1
- Item 2
- Item 3
*/
```

## Example Notebook

```javascript
// ---
// title: Data Analysis Example
// id: notebook-12345
// ---

// %% [markdown]
/*
# Data Analysis

This notebook demonstrates data analysis with JavaScript.
*/

// %% [javascript]

// Import libraries
import * as d3 from 'd3';

// Load data
const data = [1, 2, 3, 4, 5];
console.log('Data loaded:', data);

// %% [javascript]

// Calculate statistics
const sum = data.reduce((a, b) => a + b, 0);
const average = sum / data.length;

({ sum, average })

// %% [markdown]
/*
## Results

The analysis shows interesting patterns in the data.
*/
```

## Advantages

### Git-Friendly
- **No timestamps**: The format excludes execution timestamps, reducing git diff noise
- **Human-readable**: Easy to review changes in pull requests
- **Mergeable**: Conflicts are easier to resolve than with JSON

### Simple
- **Plain text**: Can be edited in any text editor
- **Clear structure**: Cell boundaries are obvious
- **Syntax highlighting**: Works with JavaScript syntax highlighters

### Compatible
- **Import/Export**: Notebooks can be imported and exported in this format
- **Version control**: Track changes over time effectively
- **Collaboration**: Team members can work on notebooks using standard git workflows

## Working with the Format

### Creating a New Notebook

1. Click "New" in the menu
2. Add cells and edit content
3. Click "Save" to save in localStorage
4. Click "Export" > "JavaScript (.js)" to download as a file

### Importing a Notebook

1. Click "Import" in the menu
2. Select a `.js` notebook file
3. The notebook will be parsed and loaded

### Editing Manually

You can edit notebook files directly in a text editor:

1. Open the `.js` file
2. Edit cell content between delimiters
3. Save the file
4. Import back into Tangent Notebook

## Comparison with JSON Format

### Text Format (.js)
```javascript
// %% [javascript]
const x = 42;
```

**Pros:**
- Git-friendly (no timestamps)
- Human-readable
- Easy to merge
- Compact

**Cons:**
- Doesn't preserve execution outputs
- Requires parsing

### JSON Format (.json)
```json
{
  "id": "notebook-123",
  "name": "My Notebook",
  "cells": [
    {
      "id": "cell-1",
      "type": "code",
      "content": "const x = 42;",
      "output": { ... }
    }
  ],
  "createdAt": 1697000000000,
  "updatedAt": 1697140000000
}
```

**Pros:**
- Preserves all metadata
- Includes execution outputs
- Structured data

**Cons:**
- Verbose
- Timestamps cause git noise
- Hard to read/edit manually
- Merge conflicts are difficult

## Best Practices

1. **Use descriptive titles**: Make it easy to identify notebooks
2. **Add markdown documentation**: Explain what each section does
3. **Keep cells focused**: One concept per cell
4. **Commit frequently**: Take advantage of git-friendly format
5. **Review diffs**: Changes are easy to see in pull requests

## Migration

### From JSON to Text

1. Open a JSON notebook in Tangent
2. Click "Export" > "JavaScript (.js)"
3. Save the file
4. The notebook is now in text format

### From Text to JSON

1. Open a text format notebook in Tangent
2. Click "Export" > "JSON"
3. Save the file
4. The notebook is now in JSON format (with all metadata)

## Technical Details

### Parser Implementation

The parser (`notebookFormat.ts`) handles:
- Header metadata extraction
- Cell delimiter detection
- Markdown block parsing (/* ... */)
- Cell content extraction
- Error handling

### Serializer Implementation

The serializer converts internal notebook structure to text:
- Generates header with metadata
- Writes cell delimiters
- Wraps markdown in /* ... */
- Preserves cell order
- Handles empty cells

## Future Enhancements

Potential improvements to the format:
- Cell execution metadata (optional)
- Cell tags/labels
- Cell dependencies
- Multi-language support (Python, R, etc.)
- Custom cell types
