CREATE TABLE IF NOT EXISTS "kk_propiedad_participante" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"user_id" text,
	"contact_id" text,
	"rol" text NOT NULL,
	"porcentaje_bp" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kk_propiedad_participante_quien_ck" CHECK (("kk_propiedad_participante"."user_id" IS NULL) <> ("kk_propiedad_participante"."contact_id" IS NULL)),
	CONSTRAINT "kk_propiedad_participante_bp_ck" CHECK ("kk_propiedad_participante"."porcentaje_bp" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_propiedad_participante" ADD CONSTRAINT "kk_propiedad_participante_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_propiedad_participante" ADD CONSTRAINT "kk_propiedad_participante_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_propiedad_participante" ADD CONSTRAINT "kk_propiedad_participante_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_propiedad_participante" ADD CONSTRAINT "kk_propiedad_participante_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_propiedad_participante_org_prop_idx" ON "kk_propiedad_participante" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_propiedad_participante_org_contact_idx" ON "kk_propiedad_participante" USING btree ("organization_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kk_propiedad_participante_user_uq" ON "kk_propiedad_participante" USING btree ("property_id","user_id") WHERE "kk_propiedad_participante"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kk_propiedad_participante_contact_uq" ON "kk_propiedad_participante" USING btree ("property_id","contact_id") WHERE "kk_propiedad_participante"."contact_id" IS NOT NULL;