export class ConfirmationResponseDto {
  booking_number: string | null;
  vessel: string | null;
  voyage_number: string | null;
  shipping_line: string | null;
  etd: string | null; // Format: YYYY-MM-DD HH:MM
  eta: string | null; // Format: YYYY-MM-DD HH:MM
  pol: string | null;
  pod: string | null;
  depot: string | null;
  terminal: string | null;
  container_quantity: number | null;
  container_type: string | null; // e.g., 20'GP, 20'TK, 40'GP, 40'HQ, 40'RF
  container_commodity: string | null;
}
