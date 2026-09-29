-- Home App MySQL schema. No personal data or credentials.

SET NAMES utf8mb4;

CREATE TABLE `accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `family_id` int(11) NOT NULL,
  `owner_member_id` int(11) NOT NULL,
  `name` varchar(64) NOT NULL,
  `account_type` varchar(16) NOT NULL,
  `balance` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_family` (`family_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `app_family_data` (
  `family_id` int(11) NOT NULL,
  `revision` bigint(20) NOT NULL DEFAULT '0',
  `payload` json NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`family_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `app_legacy_backups` (
  `user_id` int(11) NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `app_personal_data` (
  `user_id` int(11) NOT NULL,
  `revision` bigint(20) NOT NULL DEFAULT '0',
  `payload` json NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `app_sessions` (
  `token_hash` char(64) COLLATE utf8_unicode_ci NOT NULL,
  `user_id` int(11) NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `app_write_receipts` (
  `user_id` int(11) NOT NULL,
  `request_id` varchar(80) COLLATE utf8_unicode_ci NOT NULL,
  `body_hash` char(64) COLLATE utf8_unicode_ci NOT NULL,
  `response` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `families` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `member_limit` int(11) NOT NULL DEFAULT '8',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `invite_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `family_id` int(11) NOT NULL,
  `code` varchar(6) NOT NULL,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_family_active` (`family_id`,`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `ledger_entries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `family_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `member_id` int(11) NOT NULL,
  `direction` varchar(8) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `source` varchar(16) NOT NULL,
  `entry_kind` varchar(16) NOT NULL,
  `title` varchar(128) DEFAULT NULL,
  `occurred_on` date NOT NULL,
  `created_at` datetime NOT NULL,
  `source_ref` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_family_day` (`family_id`,`occurred_on`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `family_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `role` varchar(16) NOT NULL,
  `display_name` varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_family` (`family_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `phone` varchar(11) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nickname` varchar(64) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
