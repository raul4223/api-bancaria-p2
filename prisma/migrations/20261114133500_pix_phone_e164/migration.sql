-- Migrar telefones de chaves Pix para o formato internacional +55DDDNUMERO
UPDATE `PixKey`
  SET `keyValue` = CONCAT('+55', `keyValue`)
  WHERE `keyType` = 'PHONE' AND `keyValue` NOT LIKE '+%';

-- Acompanhar a migração nos favorecidos PIX que apontam para essas chaves
UPDATE `Beneficiary` b
  JOIN `PixKey` p ON p.`keyValue` = CONCAT('+55', b.`pixKey`) AND p.`keyType` = 'PHONE'
  SET b.`pixKey` = p.`keyValue`
  WHERE b.`transferType` = 'PIX' AND b.`pixKey` NOT LIKE '+%';
