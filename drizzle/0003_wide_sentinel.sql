CREATE TABLE `custom_marbles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`origin` varchar(255),
	`baseColor` varchar(100),
	`veiningPattern` text,
	`description` text,
	`imageUrl` text NOT NULL,
	`googleDriveLink` text,
	`thumbnailUrl` text,
	`marbleAnalysis` text,
	`isPublic` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_marbles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `marble_visualizations` ADD `customMarbleImageUrl` text;--> statement-breakpoint
ALTER TABLE `marble_visualizations` ADD `highlightImageUrl` text;--> statement-breakpoint
ALTER TABLE `marble_visualizations` ADD `customMarbleId` int;