const { pool } = require('../db');

/**
 * Finds all non-deleted contacts matching the given email or phone number.
 */
const findMatchingContacts = async (client, email, phone) => {
  const { rows } = await client.query(
    `SELECT * FROM contact
     WHERE deleted_at IS NULL
       AND ((email = $1 AND $1 IS NOT NULL) OR (phone_number = $2 AND $2 IS NOT NULL))
     ORDER BY created_at ASC`,
    [email, phone]
  );
  return rows;
};

/**
 * Creates a new primary contact with the given email and phone.
 */
const createPrimaryContact = async (client, email, phone) => {
  const { rows } = await client.query(
    `INSERT INTO contact (email, phone_number, link_precedence)
     VALUES ($1, $2, 'primary')
     RETURNING *`,
    [email, phone]
  );
  return rows[0];
};

/**
 * Creates a new secondary contact linked to the given primary ID.
 */
const createSecondaryContact = async (client, email, phone, primaryId) => {
  const { rows } = await client.query(
    `INSERT INTO contact (email, phone_number, linked_id, link_precedence)
     VALUES ($1, $2, $3, 'secondary')
     RETURNING *`,
    [email, phone, primaryId]
  );
  return rows[0];
};

/**
 * Given a list of direct matches, collects all distinct root primary IDs.
 * Secondaries are resolved to their linked_id (the primary root).
 */
const collectPrimaryIds = (matches) => {
  const ids = new Set();
  for (const contact of matches) {
    ids.add(contact.link_precedence === 'primary' ? contact.id : contact.linked_id);
  }
  return Array.from(ids);
};

/**
 * Merges multiple primaries into one.
 * Oldest contact (by created_at) is elected the winner.
 * All others are demoted to secondary and their children re-pointed to the winner.
 */
const mergePrimaries = async (client, primaryIds) => {
  const { rows: primaries } = await client.query(
    `SELECT * FROM contact
     WHERE id = ANY($1::int[]) AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [primaryIds]
  );

  const winner = primaries[0];
  const losers = primaries.slice(1);

  for (const loser of losers) {
    await client.query(
      `UPDATE contact
       SET link_precedence = 'secondary', linked_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [winner.id, loser.id]
    );

    // Re-point the loser's children to the winner to avoid secondary → secondary chains.
    await client.query(
      `UPDATE contact
       SET linked_id = $1, updated_at = NOW()
       WHERE linked_id = $2 AND deleted_at IS NULL`,
      [winner.id, loser.id]
    );
  }
};

/**
 * Elects the true single primary from a list of candidate IDs.
 * Queries DB rather than relying on serial ID order, since created_at is the source of truth.
 */
const electPrimary = async (client, primaryIds) => {
  const { rows } = await client.query(
    `SELECT id FROM contact
     WHERE id = ANY($1::int[]) AND deleted_at IS NULL
     ORDER BY created_at ASC LIMIT 1`,
    [primaryIds]
  );
  return rows[0].id;
};

/**
 * Fetches the full identity cluster: the primary contact and all its secondaries.
 */
const fetchContactFamily = async (client, primaryId) => {
  const { rows } = await client.query(
    `SELECT * FROM contact
     WHERE (id = $1 OR linked_id = $1) AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [primaryId]
  );
  return rows;
};

/**
 * Checks if incoming email/phone introduces information not already known in the family.
 */
const hasNewInformation = (family, email, phone) => {
  const knownEmails = new Set(family.map(c => c.email).filter(Boolean));
  const knownPhones = new Set(family.map(c => c.phone_number).filter(Boolean));
  return (email && !knownEmails.has(email)) || (phone && !knownPhones.has(phone));
};

/**
 * Formats a contact family into the required API response shape.
 * Primary's email/phone always leads their respective arrays.
 */
const formatResponse = (family, primaryId) => {
  const primary = family.find(c => c.id === primaryId);
  const secondaries = family.filter(c => c.id !== primaryId);

  const emails = [
    ...(primary?.email ? [primary.email] : []),
    ...secondaries.map(c => c.email).filter(Boolean)
  ];
  const phoneNumbers = [
    ...(primary?.phone_number ? [primary.phone_number] : []),
    ...secondaries.map(c => c.phone_number).filter(Boolean)
  ];

  return {
    contact: {
      primaryContactId: primaryId,
      emails: [...new Set(emails)],
      phoneNumbers: [...new Set(phoneNumbers)],
      secondaryContactIds: secondaries.map(c => c.id)
    }
  };
};

/**
 * Core identity reconciliation logic.
 * Finds or creates a contact cluster based on incoming email/phone,
 * merges identities if needed, and returns the consolidated view.
 */
const reconcileIdentity = async (email, phone) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const matches = await findMatchingContacts(client, email, phone);

    if (matches.length === 0) {
      const newContact = await createPrimaryContact(client, email, phone);
      await client.query('COMMIT');
      return formatResponse([newContact], newContact.id);
    }

    const primaryIds = collectPrimaryIds(matches);

    if (primaryIds.length > 1) {
      await mergePrimaries(client, primaryIds);
    }

    const primaryId = await electPrimary(client, primaryIds);
    let family = await fetchContactFamily(client, primaryId);

    if (hasNewInformation(family, email, phone)) {
      const secondary = await createSecondaryContact(client, email, phone, primaryId);
      family.push(secondary);
    }

    await client.query('COMMIT');
    return formatResponse(family, primaryId);

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { reconcileIdentity };
