-- 058 (fork) — Re-ejecutable a propósito (IF NOT EXISTS / duplicate_object):
-- tablas con prefijo kk_ para no chocar con nada creado a mano en un servidor.
CREATE TABLE IF NOT EXISTS "kk_contacto_referido" (
	"contact_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"referidor_id" text NOT NULL,
	"property_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kk_referidor" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"web_id" text,
	"codigo" text,
	"nombre" text NOT NULL,
	"email" text,
	"telefono" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kk_web_solicitud" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tipo" text NOT NULL,
	"contact_id" text,
	"property_id" text,
	"referidor_id" text,
	"propiedad_titulo" text,
	"pagina_url" text,
	"recibido_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN IF NOT EXISTS "web_id" text;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kk_contacto_referido" ADD CONSTRAINT "kk_contacto_referido_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kk_contacto_referido" ADD CONSTRAINT "kk_contacto_referido_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kk_contacto_referido" ADD CONSTRAINT "kk_contacto_referido_referidor_id_kk_referidor_id_fk" FOREIGN KEY ("referidor_id") REFERENCES "public"."kk_referidor"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kk_contacto_referido" ADD CONSTRAINT "kk_contacto_referido_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kk_referidor" ADD CONSTRAINT "kk_referidor_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kk_web_solicitud" ADD CONSTRAINT "kk_web_solicitud_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kk_web_solicitud" ADD CONSTRAINT "kk_web_solicitud_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kk_web_solicitud" ADD CONSTRAINT "kk_web_solicitud_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kk_web_solicitud" ADD CONSTRAINT "kk_web_solicitud_referidor_id_kk_referidor_id_fk" FOREIGN KEY ("referidor_id") REFERENCES "public"."kk_referidor"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_contacto_referido_org_idx" ON "kk_contacto_referido" USING btree ("organization_id","referidor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kk_referidor_org_web_uq" ON "kk_referidor" USING btree ("organization_id","web_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kk_referidor_org_codigo_uq" ON "kk_referidor" USING btree ("organization_id","codigo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_web_solicitud_org_idx" ON "kk_web_solicitud" USING btree ("organization_id","recibido_at");