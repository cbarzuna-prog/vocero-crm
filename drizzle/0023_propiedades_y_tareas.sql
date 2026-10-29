CREATE TABLE "property" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"operation" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'disponible' NOT NULL,
	"price_cents" bigint,
	"currency" text DEFAULT 'USD' NOT NULL,
	"provincia" text NOT NULL,
	"canton" text,
	"distrito" text,
	"zona" text,
	"lat" double precision,
	"lng" double precision,
	"m2_construccion" integer,
	"m2_terreno" integer,
	"habitaciones" smallint,
	"banos_x2" smallint,
	"parqueos" smallint,
	"descripcion_publica" text,
	"notas_internas" text,
	"seller_contact_id" text,
	"comision_bp" integer,
	"exclusiva" boolean DEFAULT false NOT NULL,
	"captada_at" date,
	"url_externa" text,
	"created_by" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_interest" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"property_id" text NOT NULL,
	"status" text DEFAULT 'interesado' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_interest_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"interest_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"property_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"discard_reason" text,
	"actor_user_id" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_photo" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"media_asset_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"property_id" text,
	"title" text NOT NULL,
	"type" text DEFAULT 'llamada' NOT NULL,
	"due_at" timestamp NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"done_at" timestamp,
	"assigned_user_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_seller_contact_id_contact_id_fk" FOREIGN KEY ("seller_contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_interest" ADD CONSTRAINT "property_interest_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_interest" ADD CONSTRAINT "property_interest_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_interest" ADD CONSTRAINT "property_interest_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_interest_event" ADD CONSTRAINT "property_interest_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_interest_event" ADD CONSTRAINT "property_interest_event_interest_id_property_interest_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."property_interest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_interest_event" ADD CONSTRAINT "property_interest_event_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_interest_event" ADD CONSTRAINT "property_interest_event_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_interest_event" ADD CONSTRAINT "property_interest_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_photo" ADD CONSTRAINT "property_photo_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_photo" ADD CONSTRAINT "property_photo_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_photo" ADD CONSTRAINT "property_photo_media_asset_id_media_asset_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_org_code_uq" ON "property" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "property_org_status_op_idx" ON "property" USING btree ("organization_id","status","operation");--> statement-breakpoint
CREATE INDEX "property_org_canton_idx" ON "property" USING btree ("organization_id","canton");--> statement-breakpoint
CREATE INDEX "property_org_seller_idx" ON "property" USING btree ("organization_id","seller_contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pint_org_contact_prop_uq" ON "property_interest" USING btree ("organization_id","contact_id","property_id");--> statement-breakpoint
CREATE INDEX "pint_org_prop_idx" ON "property_interest" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX "pint_org_contact_idx" ON "property_interest" USING btree ("organization_id","contact_id");--> statement-breakpoint
CREATE INDEX "pie_org_occurred_idx" ON "property_interest_event" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pie_interest_occurred_idx" ON "property_interest_event" USING btree ("interest_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pph_org_prop_pos_idx" ON "property_photo" USING btree ("organization_id","property_id","position");--> statement-breakpoint
CREATE INDEX "task_org_done_due_idx" ON "task" USING btree ("organization_id","done_at","due_at");--> statement-breakpoint
CREATE INDEX "task_org_contact_idx" ON "task" USING btree ("organization_id","contact_id");--> statement-breakpoint
CREATE INDEX "task_org_assigned_idx" ON "task" USING btree ("organization_id","assigned_user_id","done_at","due_at");