-- Card only (Ben, 16/11/2026): Netticket does not work. If the FAQ answer
-- about paying from Africa was saved unchanged from the admin, rewrite it.
-- Matches the exact old sentence only: an answer Ben reworded stays as is.
UPDATE `site_settings`
SET `value` = CAST(REPLACE(CAST(`value` AS CHAR CHARACTER SET utf8mb4),
  'Carte bancaire, Orange Money ou MTN Mobile Money. Le prix est en USD',
  'Par carte bancaire Visa ou Mastercard. Votre argent est sur Orange Money ? L’application Max it d’Orange permet de créer une carte Visa virtuelle, de la recharger depuis Orange Money, puis de payer avec. Le prix est en USD') AS JSON)
WHERE `key` = 'faq';
