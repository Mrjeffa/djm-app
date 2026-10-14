// Tellerstand in km of mijl. In de database staat voorraad.km altijd in
// kilometers (prijscheck, sortering, website); km_eenheid zegt alleen in welke
// eenheid de teller van de motor staat.

export const MIJL_IN_KM = 1.609344;

// Ingevoerde tellerstand → kilometers voor de database
export const naarKm = (waarde, eenheid) =>
  waarde == null ? waarde : eenheid === "mijl" ? Math.round(waarde * MIJL_IN_KM) : waarde;

// Kilometers uit de database → tellerstand in de eenheid van de motor
export const vanKm = (km, eenheid) =>
  km == null ? km : eenheid === "mijl" ? Math.round(km / MIJL_IN_KM) : km;

const nl = (n) => Number(n || 0).toLocaleString("nl-NL");

// "15.000 km" of "12.000 mijl (19.312 km)"
export const kmTekst = (km, eenheid) =>
  eenheid === "mijl" ? `${nl(vanKm(Number(km) || 0, "mijl"))} mijl (${nl(km)} km)` : `${nl(km)} km`;
