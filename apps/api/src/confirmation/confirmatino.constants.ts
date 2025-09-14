import { z } from 'zod';

export const CONFIRMATION_SYSTEM_PROMPT = `
    Necesito que me extraigas los siguientes datos del documento y retornes únicamente el JSON con los datos.

    Datos:
    - booking_number
    - vessel
    - voyage_number
    - shipping_line
    - etd
    - eta
    - pol
    - pod
    - depot
    - terminal
    - container_quantity
    - container_type
    - container_commodity

    Reglas:
    - La respuesta tiene que venir en formato JSON.
    - Si no encuentas alguno de los datos, devuelve null.
    - Devuelve las fechas y horas en formato YYYY-MM-DD HH:MM.
    - El container_type es el nombre del tipo, que debe ser un de los siguientes 20'GP, 20'TK, 40'GP, 40'HQ, 40'RF
    - Si el booking tiene el formato "SCL500170600" la naviera es PIL
    - Si la naviera es PIL el terminal viene escrito bajo "Full Return CY"
    - Si el depot es "SERVICIOS INTEGRADOS DE TRANSPORTES LTDA.", devuelve "SITRANS"
`;

export const CONFIRMATION_SCHEMA = z.object({
  booking_number: z.string().nullable(),
  vessel: z.string().nullable(),
  voyage_number: z.string().nullable(),
  shipping_line: z.string().nullable(),
  etd: z.string().nullable(),
  eta: z.string().nullable(),
  pol: z.string().nullable(),
  pod: z.string().nullable(),
  depot: z.string().nullable(),
  terminal: z.string().nullable(),
  container_quantity: z.number().nullable(),
  container_type: z.string().nullable(),
  container_commodity: z.string().nullable(),
});
