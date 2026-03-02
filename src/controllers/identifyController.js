const { pool } = require('../db');

const identify = async (req, res, next) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Either email or phoneNumber must be provided.' });
  }

  const emailStr = email ? String(email) : null;
  const phoneStr = phoneNumber ? String(phoneNumber) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find directly matching contacts
    const matchQuery = `
      SELECT id, linked_id, link_precedence 
      FROM contact 
      WHERE (email = $1 AND $1 IS NOT NULL) 
         OR (phone_number = $2 AND $2 IS NOT NULL)
      ORDER BY created_at ASC
    `;
    const matchResult = await client.query(matchQuery, [emailStr, phoneStr]);
    const matches = matchResult.rows;

    if (matches.length === 0) {
      // 2. No match exists - create primary
      const insertQuery = `
        INSERT INTO contact (email, phone_number, link_precedence)
        VALUES ($1, $2, 'primary')
        RETURNING id, email, phone_number
      `;
      const insertResult = await client.query(insertQuery, [emailStr, phoneStr]);
      const newContact = insertResult.rows[0];
      
      await client.query('COMMIT');
      return res.status(200).json({
        contact: {
          primaryContactId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phone_number ? [newContact.phone_number] : [],
          secondaryContactIds: []
        }
      });
    }

    // 3. Match exists. Find the primary contact root.
    // For now, we take the primary of the oldest mapped contact.
    let primaryId = matches[0].link_precedence === 'primary' 
      ? matches[0].id 
      : matches[0].linked_id;

    // 4. Fetch the entire family for this primary
    const familyQuery = `
      SELECT id, email, phone_number, link_precedence
      FROM contact
      WHERE id = $1 OR linked_id = $1
      ORDER BY created_at ASC
    `;
    const familyResult = await client.query(familyQuery, [primaryId]);
    let family = familyResult.rows;

    // 5. Check if we need to insert new info as a secondary contact
    const familyEmails = family.map(c => c.email).filter(Boolean);
    const familyPhones = family.map(c => c.phone_number).filter(Boolean);

    let hasNewEmail = emailStr && !familyEmails.includes(emailStr);
    let hasNewPhone = phoneStr && !familyPhones.includes(phoneStr);

    if (hasNewEmail || hasNewPhone) {
      const insertSecQuery = `
        INSERT INTO contact (email, phone_number, linked_id, link_precedence)
        VALUES ($1, $2, $3, 'secondary')
        RETURNING id, email, phone_number, link_precedence
      `;
      const insertSecResult = await client.query(insertSecQuery, [emailStr, phoneStr, primaryId]);
      family.push(insertSecResult.rows[0]);
    }

    await client.query('COMMIT');

    // 6. Format the response
    const uniqueEmails = [...new Set(family.map(c => c.email).filter(Boolean))];
    const uniquePhones = [...new Set(family.map(c => c.phone_number).filter(Boolean))];
    const secondaryIds = family.filter(c => c.link_precedence === 'secondary').map(c => c.id);

    return res.status(200).json({
      contact: {
        primaryContactId: primaryId,
        emails: uniqueEmails,
        phoneNumbers: uniquePhones,
        secondaryContactIds: secondaryIds
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  identify
};
