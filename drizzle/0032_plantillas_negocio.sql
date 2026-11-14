CREATE TABLE IF NOT EXISTS "kk_config_negocio" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"plantilla" text NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"setup_paso" smallint,
	"aplicada_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kk_etapa_criterio" (
	"stage_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"clave" text NOT NULL,
	"criterio" text,
	"requisitos" text[] DEFAULT '{}'::text[] NOT NULL,
	"accion" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kk_extraccion" (
	"contact_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ultimo_mensaje_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kk_ficha_valor" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"campo" text NOT NULL,
	"valor" jsonb NOT NULL,
	"fuente" text NOT NULL,
	"por_user_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kk_registro" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"estado" text NOT NULL,
	"fecha" timestamp,
	"importe_cents" bigint,
	"moneda" text,
	"datos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_por_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kk_sugerencia" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"campo" text NOT NULL,
	"valor" jsonb NOT NULL,
	"evidencia" text,
	"mensaje_id" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"resuelta_por_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resuelta_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_config_negocio" ADD CONSTRAINT "kk_config_negocio_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_etapa_criterio" ADD CONSTRAINT "kk_etapa_criterio_stage_id_pipeline_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stage"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_etapa_criterio" ADD CONSTRAINT "kk_etapa_criterio_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_extraccion" ADD CONSTRAINT "kk_extraccion_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_extraccion" ADD CONSTRAINT "kk_extraccion_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_ficha_valor" ADD CONSTRAINT "kk_ficha_valor_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_ficha_valor" ADD CONSTRAINT "kk_ficha_valor_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_ficha_valor" ADD CONSTRAINT "kk_ficha_valor_por_user_id_user_id_fk" FOREIGN KEY ("por_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_registro" ADD CONSTRAINT "kk_registro_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_registro" ADD CONSTRAINT "kk_registro_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_registro" ADD CONSTRAINT "kk_registro_creado_por_user_id_user_id_fk" FOREIGN KEY ("creado_por_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_sugerencia" ADD CONSTRAINT "kk_sugerencia_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_sugerencia" ADD CONSTRAINT "kk_sugerencia_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kk_sugerencia" ADD CONSTRAINT "kk_sugerencia_resuelta_por_user_id_user_id_fk" FOREIGN KEY ("resuelta_por_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kk_ficha_valor_contacto_campo_uq" ON "kk_ficha_valor" USING btree ("contact_id","campo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_ficha_valor_org_idx" ON "kk_ficha_valor" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_registro_org_contacto_idx" ON "kk_registro" USING btree ("organization_id","contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_registro_org_tipo_fecha_idx" ON "kk_registro" USING btree ("organization_id","tipo","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_sugerencia_contacto_estado_idx" ON "kk_sugerencia" USING btree ("contact_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kk_sugerencia_org_idx" ON "kk_sugerencia" USING btree ("organization_id");