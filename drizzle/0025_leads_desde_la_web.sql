CREATE TABLE "web_lead" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"external_id" text NOT NULL,
	"contact_id" text,
	"property_id" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "web_lead" ADD CONSTRAINT "web_lead_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_lead" ADD CONSTRAINT "web_lead_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_lead" ADD CONSTRAINT "web_lead_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "web_lead_org_external_uq" ON "web_lead" USING btree ("organization_id","external_id");--> statement-breakpoint
CREATE INDEX "web_lead_org_contact_idx" ON "web_lead" USING btree ("organization_id","contact_id");