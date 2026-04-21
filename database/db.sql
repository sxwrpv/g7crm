
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

CREATE TABLE customers (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  UNIQUE NOT NULL,
  phone       VARCHAR(25),
  company     VARCHAR(100),
  address     TEXT,
  status      VARCHAR(20)   DEFAULT 'lead'
                            CHECK (status IN ('lead', 'active', 'inactive')),
  notes       TEXT,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE interactions (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id  UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type         VARCHAR(20)  NOT NULL
                            CHECK (type IN ('call', 'email', 'meeting', 'note')),
  subject      VARCHAR(200) NOT NULL,
  notes        TEXT,
  date         TIMESTAMPTZ  DEFAULT NOW(),
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE deals (
  id           UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id  UUID          NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title        VARCHAR(200)  NOT NULL,
  value        NUMERIC(12,2) DEFAULT 0,
  stage        VARCHAR(30)   DEFAULT 'prospect'
                             CHECK (stage IN ('prospect','proposal','negotiation','closed-won','closed-lost')),
  description  TEXT,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE tasks (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id  UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  deal_id      UUID         REFERENCES deals(id) ON DELETE SET NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  due_date     DATE,
  status       VARCHAR(20)  DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in-progress', 'done')),
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on customers"    ON customers    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on interactions" ON interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on deals"        ON deals        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tasks"        ON tasks        FOR ALL USING (true) WITH CHECK (true);

INSERT INTO customers (name, email, phone, company, address, status) VALUES
  ('Alice Johnson',  'alice@techcorp.com',   '+353 1 234 5678',  'TechCorp Ltd',        '10 Grand Canal Dock, Dublin 2',          'active'),
  ('Bob Williams',   'bob@innovate.ie',      '+353 87 123 4567', 'Innovate Ireland',    '22 Silicon Docks, Dublin 4',             'lead'),
  ('Carol Davis',    'carol@greenfield.com', '+353 1 987 6543',  'Greenfield Solutions','5 Business Park, Cork',                  'active'),
  ('David Murphy',   'david@dublintech.ie',  '+353 86 987 6543', 'Dublin Tech',         '78 Tallaght Business Centre, Dublin 24', 'inactive'),
  ('Emma O''Brien',  'emma@atlantic.ie',     '+353 85 456 7890', 'Atlantic Ventures',   '12 Galway Bay Road, Galway',             'lead');

INSERT INTO interactions (customer_id, type, subject, notes, date)
  SELECT id, 'call',    'Initial discovery call',   'Discussed product requirements and budget.',    NOW() - INTERVAL '5 days'  FROM customers WHERE email = 'alice@techcorp.com';
INSERT INTO interactions (customer_id, type, subject, notes, date)
  SELECT id, 'email',   'Proposal follow-up',       'Sent updated proposal PDF via email.',          NOW() - INTERVAL '2 days'  FROM customers WHERE email = 'alice@techcorp.com';
INSERT INTO interactions (customer_id, type, subject, notes, date)
  SELECT id, 'meeting', 'Intro meeting',             'Met at their office — strong interest shown.',  NOW() - INTERVAL '7 days'  FROM customers WHERE email = 'bob@innovate.ie';
INSERT INTO interactions (customer_id, type, subject, notes, date)
  SELECT id, 'note',    'Budget confirmed',          'Customer confirmed budget of €15,000.',         NOW() - INTERVAL '1 day'   FROM customers WHERE email = 'carol@greenfield.com';
INSERT INTO interactions (customer_id, type, subject, notes, date)
  SELECT id, 'call',    'Check-in call',             'Discussed onboarding progress.',                NOW() - INTERVAL '3 days'  FROM customers WHERE email = 'carol@greenfield.com';

INSERT INTO deals (customer_id, title, value, stage, description)
  SELECT id, 'Enterprise License',     12000.00, 'proposal',     'Full platform license for 50 seats.'  FROM customers WHERE email = 'alice@techcorp.com';
INSERT INTO deals (customer_id, title, value, stage, description)
  SELECT id, 'Starter Package',         2500.00, 'prospect',     'Entry-level plan for small team.'     FROM customers WHERE email = 'bob@innovate.ie';
INSERT INTO deals (customer_id, title, value, stage, description)
  SELECT id, 'Platform Integration',    8750.00, 'negotiation',  'Custom API integration project.'      FROM customers WHERE email = 'carol@greenfield.com';
INSERT INTO deals (customer_id, title, value, stage, description)
  SELECT id, 'Annual Support Contract', 5000.00, 'closed-won',   'Yearly support and maintenance.'      FROM customers WHERE email = 'alice@techcorp.com';
INSERT INTO deals (customer_id, title, value, stage, description)
  SELECT id, 'Legacy Migration',        3200.00, 'closed-lost',  'Lost to competitor on pricing.'       FROM customers WHERE email = 'david@dublintech.ie';

INSERT INTO tasks (customer_id, title, description, due_date, status)
  SELECT id, 'Send follow-up email',   'Follow up on the proposal sent last week.',     CURRENT_DATE + 1, 'pending'     FROM customers WHERE email = 'alice@techcorp.com';
INSERT INTO tasks (customer_id, title, description, due_date, status)
  SELECT id, 'Schedule demo call',     'Arrange a product demo for the team.',          CURRENT_DATE,     'pending'     FROM customers WHERE email = 'bob@innovate.ie';
INSERT INTO tasks (customer_id, title, description, due_date, status)
  SELECT id, 'Prepare contract draft', 'Legal team to review contract template.',       CURRENT_DATE + 3, 'in-progress' FROM customers WHERE email = 'carol@greenfield.com';
INSERT INTO tasks (customer_id, title, description, due_date, status)
  SELECT id, 'Monthly check-in call',  'Routine monthly check-in with the customer.',   CURRENT_DATE + 7, 'pending'     FROM customers WHERE email = 'alice@techcorp.com';
INSERT INTO tasks (customer_id, title, description, due_date, status)
  SELECT id, 'Send welcome pack',      'Email onboarding materials and login details.', CURRENT_DATE - 1, 'done'        FROM customers WHERE email = 'carol@greenfield.com';
