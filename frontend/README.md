# Frontend

Web UI for Simple GIF Editor, built with React, Vite and TypeScript.

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to http://localhost:8000
npm run typecheck
npm test
npm run build      # outputs dist/, served by the backend when FRONTEND_DIR points at it
```

Set `API_URL` to proxy to a backend on another address.
