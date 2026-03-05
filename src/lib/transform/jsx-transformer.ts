import * as Babel from "@babel/standalone";

export interface TransformResult {
  code: string;
  error?: string;
  missingImports?: Set<string>;
  cssImports?: Set<string>;
}

function createPlaceholderModule(componentName: string): string {
  return `
import React from 'react';
const ${componentName} = function() {
  return React.createElement('div', {}, null);
}
export default ${componentName};
export { ${componentName} };
`;
}

export function transformJSX(
  code: string,
  filename: string,
  existingFiles: Set<string>
): TransformResult {
  try {
    const isTypeScript = filename.endsWith(".ts") || filename.endsWith(".tsx");

    let processedCode = code;
    const importRegex =
      /import\s+(?:{[^}]+}|[^,\s]+)?\s*(?:,\s*{[^}]+})?\s+from\s+['"]([^'"]+)['"]/g;
    const imports = new Set<string>();
    const cssImports = new Set<string>();

    const cssImportRegex = /import\s+['"]([^'"]+\.css)['"]/g;
    let cssMatch;
    while ((cssMatch = cssImportRegex.exec(code)) !== null) {
      cssImports.add(cssMatch[1]);
    }

    processedCode = processedCode.replace(cssImportRegex, "");

    let match;
    while ((match = importRegex.exec(code)) !== null) {
      if (!match[1].endsWith(".css")) {
        imports.add(match[1]);
      }
    }

    const result = Babel.transform(processedCode, {
      filename,
      presets: [
        ["react", { runtime: "automatic" }],
        ...(isTypeScript ? ["typescript"] : []),
      ],
      plugins: [],
    });

    return {
      code: result.code || "",
      missingImports: imports,
      cssImports: cssImports,
    };
  } catch (error) {
    return {
      code: "",
      error: error instanceof Error ? error.message : "Unknown transform error",
    };
  }
}

export function createBlobURL(
  code: string,
  mimeType: string = "application/javascript"
): string {
  const blob = new Blob([code], { type: mimeType });
  return URL.createObjectURL(blob);
}

export interface ImportMapResult {
  importMap: string;
  styles: string;
  errors: Array<{ path: string; error: string }>;
}

export function createImportMap(files: Map<string, string>): ImportMapResult {
  const imports: Record<string, string> = {
    react: "https://esm.sh/react@19",
    "react-dom": "https://esm.sh/react-dom@19",
    "react-dom/client": "https://esm.sh/react-dom@19/client",
    "react/jsx-runtime": "https://esm.sh/react@19/jsx-runtime",
    "react/jsx-dev-runtime": "https://esm.sh/react@19/jsx-dev-runtime",
  };

  const transformedFiles = new Map<string, string>();
  const existingFiles = new Set(files.keys());
  const allImports = new Set<string>();
  const allCssImports = new Set<{ from: string; cssPath: string }>();
  let collectedStyles = "";
  const errors: Array<{ path: string; error: string }> = [];

  for (const [path, content] of files) {
    if (
      path.endsWith(".js") ||
      path.endsWith(".jsx") ||
      path.endsWith(".ts") ||
      path.endsWith(".tsx")
    ) {
      const { code, error, missingImports, cssImports } = transformJSX(
        content,
        path,
        existingFiles
      );

      if (error) {
        errors.push({ path, error });
        continue;
      }

      const blobUrl = createBlobURL(code);
      transformedFiles.set(path, blobUrl);

      if (missingImports) {
        missingImports.forEach((imp) => {
          const isPackage =
            !imp.startsWith(".") &&
            !imp.startsWith("/") &&
            !imp.startsWith("@/");

          if (isPackage) {
            imports[imp] = `https://esm.sh/${imp}`;
          } else {
            allImports.add(imp);
          }
        });
      }

      if (cssImports) {
        cssImports.forEach((cssImport) => {
          allCssImports.add({ from: path, cssPath: cssImport });
        });
      }

      imports[path] = blobUrl;

      if (path.startsWith("/")) {
        imports[path.substring(1)] = blobUrl;
      }

      if (path.startsWith("/")) {
        imports["@" + path] = blobUrl;
        imports["@/" + path.substring(1)] = blobUrl;
      }

      const pathWithoutExt = path.replace(/\.(jsx?|tsx?)$/, "");
      imports[pathWithoutExt] = blobUrl;

      if (path.startsWith("/")) {
        imports[pathWithoutExt.substring(1)] = blobUrl;
        imports["@" + pathWithoutExt] = blobUrl;
        imports["@/" + pathWithoutExt.substring(1)] = blobUrl;
      }
    } else if (path.endsWith(".css")) {
      collectedStyles += `/* ${path} */\n${content}\n\n`;
    }
  }

  for (const { from, cssPath } of allCssImports) {
    let resolvedPath = cssPath;

    if (cssPath.startsWith("@/")) {
      resolvedPath = cssPath.replace("@/", "/");
    } else if (cssPath.startsWith("./") || cssPath.startsWith("../")) {
      const fromDir = from.substring(0, from.lastIndexOf("/"));
      resolvedPath = resolveRelativePath(fromDir, cssPath);
    }

    if (!files.has(resolvedPath)) {
      collectedStyles += `/* ${cssPath} not found */\n`;
    }
  }

  for (const importPath of allImports) {
    if (imports[importPath] || importPath.startsWith("react")) {
      continue;
    }

    const isPackage =
      !importPath.startsWith(".") &&
      !importPath.startsWith("/") &&
      !importPath.startsWith("@/");

    if (isPackage) {
      imports[importPath] = `https://esm.sh/${importPath}`;
      continue;
    }

    let found = false;
    const variations = [
      importPath,
      importPath + ".jsx",
      importPath + ".tsx",
      importPath + ".js",
      importPath + ".ts",
      importPath.replace("@/", "/"),
      importPath.replace("@/", "/") + ".jsx",
      importPath.replace("@/", "/") + ".tsx",
    ];

    for (const variant of variations) {
      if (imports[variant] || files.has(variant)) {
        found = true;
        break;
      }
    }

    if (!found) {
      const match = importPath.match(/\/([^\/]+)$/);
      const componentName = match
        ? match[1]
        : importPath.replace(/[^a-zA-Z0-9]/g, "");

      const placeholderCode = createPlaceholderModule(componentName);
      const placeholderUrl = createBlobURL(placeholderCode);

      imports[importPath] = placeholderUrl;
      if (importPath.startsWith("@/")) {
        imports[importPath.replace("@/", "/")] = placeholderUrl;
        imports[importPath.replace("@/", "")] = placeholderUrl;
      }
    }
  }

  return {
    importMap: JSON.stringify({ imports }, null, 2),
    styles: collectedStyles,
    errors,
  };
}

function resolveRelativePath(fromDir: string, relativePath: string): string {
  const parts = fromDir.split("/").filter(Boolean);
  const relParts = relativePath.split("/");

  for (const part of relParts) {
    if (part === "..") {
      parts.pop();
    } else if (part !== ".") {
      parts.push(part);
    }
  }

  return "/" + parts.join("/");
}

export function createPreviewHTML(
  entryPoint: string,
  importMap: string,
  styles: string = "",
  errors: Array<{ path: string; error: string }> = []
): string {
  let entryPointUrl = entryPoint;
  try {
    const importMapObj = JSON.parse(importMap);
    if (importMapObj.imports && importMapObj.imports[entryPoint]) {
      entryPointUrl = importMapObj.imports[entryPoint];
    }
  } catch (e) {
    console.error("Failed to parse import map:", e);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { width: 100vw; height: 100vh; }
    .error-boundary { color: red; padding: 1rem; border: 2px solid red; margin: 1rem; border-radius: 4px; background: #fee; }
    .syntax-errors { background: #fef5f5; border: 2px solid #ff6b6b; border-radius: 12px; padding: 32px; margin: 24px; font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .syntax-errors h3 { color: #dc2626; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .syntax-errors .error-item { margin: 16px 0; padding: 16px; background: #fff; border-radius: 8px; border-left: 4px solid #ff6b6b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .syntax-errors .error-path { font-weight: 600; color: #991b1b; font-size: 15px; margin-bottom: 8px; }
    .syntax-errors .error-message { color: #7c2d12; margin-top: 8px; white-space: pre-wrap; line-height: 1.5; font-size: 13px; }
    .syntax-errors .error-location { display: inline-block; background: #fee0e0; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px; color: #991b1b; }
  </style>
  ${styles ? `<style>\n${styles}</style>` : ""}
  <script type="importmap">
    ${importMap}
  </script>
</head>
<body>
  ${
    errors.length > 0
      ? `<div class="syntax-errors">
      <h3>Syntax Error${errors.length > 1 ? "s" : ""} (${errors.length})</h3>
      ${errors
        .map((e) => {
          const locationMatch = e.error.match(/\((\d+:\d+)\)/);
          const location = locationMatch ? locationMatch[1] : "";
          const cleanError = e.error.replace(/\(\d+:\d+\)/, "").trim();
          return `<div class="error-item">
          <div class="error-path">${e.path}${location ? `<span class="error-location">${location}</span>` : ""}</div>
          <div class="error-message">${cleanError.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>`;
        })
        .join("")}
    </div>`
      : ""
  }
  <div id="root"></div>
  ${
    errors.length === 0
      ? `<script type="module">
    import React from 'react';
    import ReactDOM from 'react-dom/client';

    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) { return { hasError: true, error }; }
      componentDidCatch(error, errorInfo) { console.error('Error caught by boundary:', error, errorInfo); }
      render() {
        if (this.state.hasError) {
          return React.createElement('div', { className: 'error-boundary' },
            React.createElement('h2', null, 'Something went wrong'),
            React.createElement('pre', null, this.state.error?.toString())
          );
        }
        return this.props.children;
      }
    }

    async function loadApp() {
      try {
        const module = await import('${entryPointUrl}');
        const App = module.default || module.App;
        if (!App) throw new Error('No default export or App export found in ${entryPoint}');
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(ErrorBoundary, null, React.createElement(App)));
      } catch (error) {
        console.error('Failed to load app:', error);
        document.getElementById('root').innerHTML = '<div class="error-boundary"><h2>Failed to load app</h2><pre>' + error.toString() + '</pre></div>';
      }
    }

    loadApp();
  </script>`
      : ""
  }
</body>
</html>`;
}
