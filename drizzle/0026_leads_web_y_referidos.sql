CREATE TABLE "contact_referencia" (
	"contact_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"referidor_id" text NOT NULL,
	"property_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referidor" (
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
CREATE TABLE "web_lead" (
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
ALTER TABLE "property" ADD COLUMN "web_id" text;--> statement-breakpoint
ALTER TABLE "contact_referencia" ADD CONSTRAINT "contact_referencia_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_referencia" ADD CONSTRAINT "contact_referencia_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_referencia" ADD CONSTRAINT "contact_referencia_referidor_id_referidor_id_fk" FOREIGN KEY ("referidor_id") REFERENCES "public"."referidor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_referencia" ADD CONSTRAINT "contact_referencia_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referidor" ADD CONSTRAINT "referidor_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_lead" ADD CONSTRAINT "web_lead_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_lead" ADD CONSTRAINT "web_lead_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_lead" ADD CONSTRAINT "web_lead_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_lead" ADD CONSTRAINT "web_lead_referidor_id_referidor_id_fk" FOREIGN KEY ("referidor_id") REFERENCES "public"."referidor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_referencia_org_ref_idx" ON "contact_referencia" USING btree ("organization_id","referidor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referidor_org_web_uq" ON "referidor" USING btree ("organization_id","web_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referidor_org_codigo_uq" ON "referidor" USING btree ("organization_id","codigo");--> statement-breakpoint
CREATE INDEX "web_lead_org_recibido_idx" ON "web_lead" USING btree ("organization_id","recibido_at");