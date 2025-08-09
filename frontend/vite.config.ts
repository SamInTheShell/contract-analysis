import path from "path"

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        proxy: {
            // this is a proxy for the backend during development
            // it will forward requests from /api to the backend server
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                ws: true, // enable WebSocket proxying
                // rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
})
