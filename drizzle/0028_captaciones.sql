CREATE TABLE IF NOT EXISTS "kk_captacion_evento" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"de_etapa" text,
	"a_etapa" text NOT NULL,
	"actor_user_id" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "captacion_etapa" text;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "captacion_desde" timestamp;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "exclusiva_vence" date;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "motivo_no_captada" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_captacion_evento" ADD CONSTRAINT "kk_captacion_evento_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_captacion_evento" ADD CONSTRAINT "kk_captacion_evento_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_captacion_evento" ADD CONSTRAINT "kk_captacion_evento_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_captacion_evento_org_prop_idx" ON "kk_captacion_evento" USING btree ("organization_id","property_id","occurred_at");--> statement-breakpoint
-- Las propiedades que ya estaban «En captación» entran al tablero en Contacto.
UPDATE "property" SET "captacion_etapa" = 'contacto', "captacion_desde" = "created_at"
 WHERE "status" = 'captacion' AND "captacion_etapa" IS NULL AND "archived_at" IS NULL;
