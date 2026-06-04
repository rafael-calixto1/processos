import express from 'express';
import { hubsoft } from '../services/hubsoft/hubsoftClient.js';
import { getToken } from '../services/hubsoft/hubsoftAuth.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();


// Confirms that token acquisition works
router.get('/health', async (req, res) => {
  try {
    await getToken();
    res.json({ status: 'ok', message: 'HubSoft token acquired successfully' });
  } catch (err) {
    res.status(502).json({ status: 'error', message: err.message });
  }
});

// Generic read proxy — useful during integration prototyping
// Usage: GET /api/hubsoft/proxy/some/api/endpoint?param=value
router.get('/proxy/*', verifyToken, async (req, res) => {
  try {
    const apiPath = req.params[0];
    const data = await hubsoft.get(apiPath, req.query);
    res.json(data);
  } catch (err) {
    const status = err.message.includes('[401]') ? 401
      : err.message.includes('[404]') ? 404
      : 502;
    res.status(status).json({ error: err.message });
  }
});


// GraphQL proxy — forwards query/variables to HubSoft's /graphql/v1 endpoint
router.post('/graphql', verifyToken, async (req, res) => {
  try {
    const { query, variables } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing "query" in request body' });
    const data = await hubsoft.graphql(query, variables);
    res.json(data);
  } catch (err) {
    const status = err.message.includes('[401]') ? 401
      : err.message.includes('[404]') ? 404
      : 502;
    res.status(status).json({ error: err.message });
  }
});

// GET Técnicos
router.get('/tecnicos', verifyToken, async (req, res) => {
  try {
    const data = await hubsoft.get('api/v1/integracao/configuracao/tecnico', req.query);
    res.json(data);
  } catch (err) {
    const status = err.message.includes('[401]') ? 401
      : err.message.includes('[404]') ? 404
      : 502;
    res.status(status).json({ error: err.message });
  }
});

export default router;
