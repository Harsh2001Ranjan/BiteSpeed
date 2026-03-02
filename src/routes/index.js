const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
