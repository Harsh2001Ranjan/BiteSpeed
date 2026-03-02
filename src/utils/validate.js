const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone: digits, spaces, hyphens, parentheses, leading +. Min 5, max 20 chars.
const PHONE_REGEX = /^\+?[\d\s\-().]{5,20}$/;

const validateIdentifyInput = ({ email, phoneNumber }) => {
  const errors = [];

  if (email !== undefined && email !== null) {
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      errors.push('email must be a valid email address.');
    }
  }

  if (phoneNumber !== undefined && phoneNumber !== null) {
    const phone = String(phoneNumber).trim();
    if (!PHONE_REGEX.test(phone)) {
      errors.push('phoneNumber must be a valid phone number (5-20 digits).');
    }
  }

  const emailProvided = email !== undefined && email !== null && String(email).trim() !== '';
  const phoneProvided = phoneNumber !== undefined && phoneNumber !== null && String(phoneNumber).trim() !== '';

  if (!emailProvided && !phoneProvided) {
    errors.push('At least one of email or phoneNumber must be provided.');
  }

  return errors;
};

module.exports = { validateIdentifyInput };
