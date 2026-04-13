-- Seed the original hardcoded confirmation prompt as version 1
-- so the versioning history starts with the prompt that was in use before versioning existed.
INSERT INTO "PromptVersion" ("version", "model", "prompt", "createdById", "createdAt")
VALUES (
  1,
  'claude-sonnet-4-5-20250929',
  E'Necesito que me extraigas los siguientes datos del documento y retornes \u00fanicamente el JSON con los datos.\n\nDatos:\n- booking_number\n- vessel\n- voyage_number\n- shipping_line\n- etd\n- eta\n- pol\n- pod\n- depot\n- terminal\n- container_quantity\n- container_type\n- container_commodity\n\nReglas:\n- La respuesta tiene que venir en formato JSON.\n- Si no encuentas alguno de los datos, devuelve null.\n- Devuelve las fechas y horas en formato YYYY-MM-DD HH:MM.\n- El container_type es el nombre del tipo, que debe ser un de los siguientes 20''GP, 20''TK, 40''GP, 40''HQ, 40''RF\n- Si el booking tiene el formato "SCL500170600" la naviera es PIL\n- Si la naviera es PIL el terminal viene escrito bajo "Full Return CY"\n- Para los puertos, retorna \u00fanicamente el nombre del puerto, sin su direcci\u00f3n.\n- Si el depot es "SERVICIOS INTEGRADOS DE TRANSPORTES LTDA.", devuelve "SITRANS"\n- Si tienes la direcci\u00f3n completa del depot, considerala tambi\u00e9n dentro de la respuesta.',
  (SELECT id FROM "User" ORDER BY id ASC LIMIT 1),
  NOW()
);
