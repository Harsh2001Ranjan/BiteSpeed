const { reconcileIdentity } = require('../services/identifyService');

const identify = async (req, res, next) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Either email or phoneNumber must be provided.' });
  }

  try {
    const emailStr = email ? String(email).trim() : null;
    const phoneStr = phoneNumber ? String(phoneNumber).trim() : null;

    const result = await reconcileIdentity(emailStr, phoneStr);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { identify };
