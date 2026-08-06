-- Preferred form of address (chosen at onboarding): how the site and Claude
-- speak to this user. 'f' = feminine singular, 'm' = masculine singular,
-- 'neutral' = plural/gender-neutral. NULL = neutral default.
ALTER TABLE users ADD COLUMN address_form TEXT;
