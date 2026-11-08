CREATE DATABASE IF NOT EXISTS bank_api_test;
CREATE DATABASE IF NOT EXISTS bank_api_shadow;
GRANT ALL PRIVILEGES ON bank_api_test.* TO 'bank_user'@'%';
GRANT ALL PRIVILEGES ON bank_api_shadow.* TO 'bank_user'@'%';
FLUSH PRIVILEGES;
