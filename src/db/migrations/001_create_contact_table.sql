CREATE TYPE link_precedence AS ENUM ('primary', 'secondary');

CREATE TABLE IF NOT EXISTS contact (
  id              SERIAL PRIMARY KEY,
  phone_number    VARCHAR(20),
  email           VARCHAR(255),
  linked_id       INTEGER REFERENCES contact(id) ON DELETE SET NULL,
  link_precedence link_precedence NOT NULL DEFAULT 'primary',
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_contact_email ON contact(email);
CREATE INDEX idx_contact_phone_number ON contact(phone_number);
CREATE INDEX idx_contact_linked_id ON contact(linked_id);
