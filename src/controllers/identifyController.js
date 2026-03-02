const { reconcileIdentity } = require('../services/identifyService');
const { validateIdentifyInput } = require('../utils/validate');

const identify = async (req, res, next) => {
  const { email, phoneNumber } = req.body;

  const errors = validateIdentifyInput({ email, phoneNumber });
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  try {
    // Normalise to trimmed strings or null — never empty strings into the DB.
    const emailStr = email ? String(email).trim() : null;
    const phoneStr = phoneNumber ? String(phoneNumber).trim() : null;

    const result = await reconcileIdentity(emailStr, phoneStr);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { identify };
