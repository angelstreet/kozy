// API lives next to the app: '/api' when served at '/' (Vercel), '/kozy/api' under the /kozy/ base (dev proxy).
export const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;
