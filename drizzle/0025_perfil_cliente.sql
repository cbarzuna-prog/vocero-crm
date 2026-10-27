CREATE TABLE "contact_perfil" (
	"contact_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text,
	"telefono2" text,
	"vive_provincia" text,
	"vive_canton" text,
	"vive_detalle" text,
	"idioma" text,
	"tipos_cliente" text[] DEFAULT '{}'::text[] NOT NULL,
	"operacion" text,
	"tipos_propiedad" text[] DEFAULT '{}'::text[] NOT NULL,
	"zonas" text[] DEFAULT '{}'::text[] NOT NULL,
	"presupuesto_min_cents" bigint,
	"presupuesto_max_cents" bigint,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"habitaciones" smallint,
	"plazo" text,
	"pago" text,
	"fuentes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_perfil_presupuesto_ck" CHECK ("contact_perfil"."presupuesto_min_cents" IS NULL OR "contact_perfil"."presupuesto_max_cents" IS NULL OR "contact_perfil"."presupuesto_min_cents" <= "contact_perfil"."presupuesto_max_cents")
);
--> statement-breakpoint
ALTER TABLE "contact_perfil" ADD CONSTRAINT "contact_perfil_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_perfil" ADD CONSTRAINT "contact_perfil_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_perfil_org_idx" ON "contact_perfil" USING btree ("organization_id");