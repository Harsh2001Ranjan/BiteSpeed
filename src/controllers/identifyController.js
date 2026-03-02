const { pool } = require('../db');

const identify = async (req, res, next) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Either email or phoneNumber must be provided.' });
  }

  const emailStr = email ? String(email).trim() : null;
  const phoneStr = phoneNumber ? String(phoneNumber).trim() : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Find all contacts that directly match the incoming email or phoneNumber.
    // Exclude soft-deleted records (deleted_at IS NULL).
    const { rows: directMatches } = await client.query(
      `SELECT * FROM contact
       WHERE deleted_at IS NULL
         AND ((email = $1 AND $1 IS NOT NULL) OR (phone_number = $2 AND $2 IS NOT NULL))
       ORDER BY created_at ASC`,
      [emailStr, phoneStr]
    );

    if (directMatches.length === 0) {
      // No contact found — create a brand new primary contact.
      const { rows } = await client.query(
        `INSERT INTO contact (email, phone_number, link_precedence)
         VALUES ($1, $2, 'primary')
         RETURNING *`,
        [emailStr, phoneStr]
      );
      await client.query('COMMIT');
      return res.status(200).json(buildResponse(rows, rows[0].id));
    }

    // Step 2: Collect all root primary IDs from direct matches.
    // A matched contact may already be secondary — follow linked_id to find its primary root.
    const primaryIdSet = new Set();
    for (const contact of directMatches) {
      if (contact.link_precedence === 'primary') {
        primaryIdSet.add(contact.id);
      } else {
        // Secondary contacts point to their primary via linked_id.
        primaryIdSet.add(contact.linked_id);
      }
    }

    // Step 3: If we found multiple distinct primaries, we must merge them.
    // The oldest (earliest created_at) becomes the winner. All others get demoted.
    if (primaryIdSet.size > 1) {
      const { rows: primaries } = await client.query(
        `SELECT * FROM contact
         WHERE id = ANY($1::int[]) AND deleted_at IS NULL
         ORDER BY created_at ASC`,
        [Array.from(primaryIdSet)]
      );

      const winner = primaries[0];
      const losers = primaries.slice(1);

      for (const loser of losers) {
        // Demote the losing primary — it now becomes secondary under the winner.
        await client.query(
          `UPDATE contact
           SET link_precedence = 'secondary', linked_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [winner.id, loser.id]
        );

        // Re-point all contacts that were secondaries of the loser to the winner.
        // Without this, they'd still point at a now-secondary contact, breaking the chain.
        await client.query(
          `UPDATE contact
           SET linked_id = $1, updated_at = NOW()
           WHERE linked_id = $2 AND deleted_at IS NULL`,
          [winner.id, loser.id]
        );
      }
    }

    // Step 4: Determine the single surviving primary.
    // Re-query from DB to handle edge cases where serial ID order != created_at order.
    const { rows: electedRows } = await client.query(
      `SELECT id FROM contact
       WHERE id = ANY($1::int[]) AND deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 1`,
      [Array.from(primaryIdSet)]
    );
    const truePrimaryId = electedRows[0].id;

    // Step 5: Fetch the full consolidated family (primary + all its secondaries).
    const { rows: fullFamily } = await client.query(
      `SELECT * FROM contact
       WHERE (id = $1 OR linked_id = $1) AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [truePrimaryId]
    );

    // Step 6: If the request has new info not yet in the family, enrich it with a new secondary.
    // This handles the case where a known email links to a brand-new phone number.
    const knownEmails = new Set(fullFamily.map(c => c.email).filter(Boolean));
    const knownPhones = new Set(fullFamily.map(c => c.phone_number).filter(Boolean));

    const isNewInfo =
      (emailStr && !knownEmails.has(emailStr)) ||
      (phoneStr && !knownPhones.has(phoneStr));

    if (isNewInfo) {
      const { rows: newSecondary } = await client.query(
        `INSERT INTO contact (email, phone_number, linked_id, link_precedence)
         VALUES ($1, $2, $3, 'secondary')
         RETURNING *`,
        [emailStr, phoneStr, truePrimaryId]
      );
      fullFamily.push(newSecondary[0]);
    }

    await client.query('COMMIT');
    return res.status(200).json(buildResponse(fullFamily, truePrimaryId));

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

// Formats family rows into the required response shape.
// Primary's email/phone always appears first in the arrays.
const buildResponse = (family, primaryId) => {
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

module.exports = { identify };
