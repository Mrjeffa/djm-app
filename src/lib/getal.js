// Getallen uit Nederlandse invoer ("6.500", "€ 8.500,--", "15.000 km") → 6500 / 8500 / 15000.
// De implementatie (met tests) staat bij de voorraad-prijscheck, die hem ook gebruikt.
export { naarBedrag } from "../../supabase/functions/voorraad-prijscheck/logica.ts";
