import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { KVStore } from './src/server/KVStore';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize DB. Place its directory inside the project root for dev/prod compatibility.
  const db = new KVStore(path.join(process.cwd(), 'data'));

  // Database Engine Endpoints
  
  app.get('/api/kv', async (req, res) => {
    try {
      const data = await db.getAll();
      res.json({ success: true, data });
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/kv/:key', async (req, res) => {
    try {
      const val = await db.get(req.params.key);
      res.json({ success: true, value: val });
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/kv/:key', async (req, res) => {
    try {
      const { value } = req.body;
      if (value === undefined) {
        return res.status(400).json({ success: false, error: 'Value required' });
      }
      await db.put(req.params.key, value);
      res.json({ success: true });
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/kv/:key', async (req, res) => {
    try {
      await db.del(req.params.key);
      res.json({ success: true });
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/actions/compact', async (req, res) => {
    try {
      await db.compact();
      res.json({ success: true });
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/wal', async (req, res) => {
    try {
      const logs = await db.getWALContents();
      res.json({ success: true, logs });
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Provide a wildcard fallback for SPA routing
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
