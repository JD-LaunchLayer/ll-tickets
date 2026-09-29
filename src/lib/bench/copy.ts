/** Turn Action API field names into the words on the phone form. */
export function plainField(message: string): string {
  return message
    .replaceAll("customer_name", "Customer name")
    .replaceAll("device_label", "Device")
    .replaceAll("reported_fault", "Reported fault")
    .replaceAll("next_move", "Next move")
    .replaceAll("text", "Note");
}
