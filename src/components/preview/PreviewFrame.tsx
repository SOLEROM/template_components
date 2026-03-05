"use client";

import { useEffect, useRef, useState } from "react";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { createImportMap, createPreviewHTML } from "@/lib/transform/jsx-transformer";

const ENTRY_CANDIDATES = ["/App.jsx", "/App.tsx", "/index.jsx", "/index.tsx", "/src/App.jsx", "/src/App.tsx"];

export function PreviewFrame() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { files } = useFileSystem();
  const [entryPoint, setEntryPoint] = useState("/App.jsx");

  const hasFiles = Object.keys(files).length > 0;

  useEffect(() => {
    if (!hasFiles) return;

    // Resolve entry point
    let ep = entryPoint;
    if (!files[ep]) {
      const found =
        ENTRY_CANDIDATES.find((p) => files[p]) ??
        Object.keys(files).find((p) => p.endsWith(".jsx") || p.endsWith(".tsx"));
      if (found) {
        ep = found;
        setEntryPoint(found);
      }
    }

    if (!files[ep]) return;

    const { importMap, styles, errors } = createImportMap(files);
    const html = createPreviewHTML(ep, importMap, styles, errors);
    if (iframeRef.current) {
      iframeRef.current.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
      iframeRef.current.srcdoc = html;
    }
  }, [files, entryPoint, hasFiles]);

  if (!hasFiles) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-gray-50">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Editor Template</h3>
          <p className="text-sm text-gray-600 mb-3">Build anything with AI assistance</p>
          <p className="text-xs text-gray-500">Ask the AI to create your first component to see it live here</p>
        </div>
      </div>
    );
  }

  return <iframe ref={iframeRef} className="w-full h-full border-0 bg-white" title="Preview" />;
}
