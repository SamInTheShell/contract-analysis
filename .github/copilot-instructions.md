# Copilot Instructions

Whenever adding new code or modifying existing code, please update these instructions accordingly.
This document provides information to help Copilot understand the structure and standards of the project.

## Project Details
TODO: This needs to be defined by the user (leave this as-is during setup).

## Frontend
The frontend uses React, TypeScript, Material UI, and Lucide.

You can use both lucid and material ui icons, just consider what fits best for the context.

The `react-markdown` package is made available for rendering markdown content. Use it to display any markdown text in the frontend.

The `pdfjs-dist` package is available for extracting text from PDF files in the frontend. Use it for client-side PDF parsing and text extraction.

When working on the frontend, please ensure that you:
- Check the available packages in the `package.json` file.
- Use packages that are already included in the project.
- Avoid adding new packages unless absolutely necessary.

New pages are stored in `frontend/src/components/pages/`.
See `frontend/src/components/pages/404.tsx` for an example of a page component.

All other components are typically stored in `frontend/src/components/layout/...`. The file name should be the system the component is a part of. For example we have `StoreItem` in `frontend/src/components/layout/store.tsx`.
