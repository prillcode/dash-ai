CREATE TABLE `personas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`persona_type` text DEFAULT 'custom' NOT NULL,
	`system_prompt` text NOT NULL,
	`model` text DEFAULT 'claude-sonnet-4-5' NOT NULL,
	`provider` text DEFAULT 'anthropic' NOT NULL,
	`allowed_tools` text DEFAULT '[]' NOT NULL,
	`context_files` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_personas_is_active` ON `personas` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_personas_created_at` ON `personas` (`created_at`);--> statement-breakpoint
CREATE TABLE `task_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_events_task_id` ON `task_events` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_events_task_id_created_at` ON `task_events` (`task_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`path` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_projects_is_active` ON `projects` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_projects_created_at` ON `projects` (`created_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`coding_persona_id` text NOT NULL,
	`coding_persona_name` text NOT NULL,
	`planning_persona_id` text,
	`planning_persona_name` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`priority` integer DEFAULT 3 NOT NULL,
	`repo_path` text NOT NULL,
`project_id` text,
	`target_files` text DEFAULT '[]' NOT NULL,
	`plan_feedback` text,
	`plan_path` text,
	`session_id` text,
	`output_log` text,
	`diff_path` text,
	`error_message` text,
	`reviewed_by` text,
	`review_note` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`coding_persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`planning_persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_coding_persona_id` ON `tasks` (`coding_persona_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_planning_persona_id` ON `tasks` (`planning_persona_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_created_at` ON `tasks` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status_created_at` ON `tasks` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_priority_created_at` ON `tasks` (`priority`,`created_at`);
