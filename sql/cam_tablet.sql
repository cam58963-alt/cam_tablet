-- リソース起動時に自動作成されますが、手動で作成する場合はこちらを実行してください
CREATE TABLE IF NOT EXISTS `cam_tablet` (
    `citizenid` VARCHAR(50) NOT NULL,
    `apps` LONGTEXT NULL,
    `settings` LONGTEXT NULL,
    `notes` LONGTEXT NULL,
    `events` LONGTEXT NULL,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
