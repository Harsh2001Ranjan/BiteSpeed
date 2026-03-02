const express = require('express');
const router = express.Router();
const { identify } = require('../controllers/identifyController');

router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

router.post('/identify', identify);

module.exports = router;
