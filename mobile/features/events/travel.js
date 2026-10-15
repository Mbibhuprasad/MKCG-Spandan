// A doctor's own arrival and departure for one event (PUT /events/:id/schedule),
// the same plans the website shows. The API only ever writes the signed-in
// doctor's plan; the venue always comes from the event itself.

export const emptyTravel = () => ({ travelFrom: '', arrivalAt: null, departureAt: null, note: '' });

export const travelToForm = (travel) =>
  travel
    ? { travelFrom: travel.from || '', arrivalAt: new Date(travel.arrivalAt), departureAt: new Date(travel.departureAt), note: travel.note || '' }
    : emptyTravel();

export const travelPayload = (form) => ({
  travelFrom: form.travelFrom.trim(),
  arrivalAt: form.arrivalAt.toISOString(),
  departureAt: form.departureAt.toISOString(),
  note: form.note.trim(),
});

// Mirrors the API's rules: an origin, both moments, and departure after
// arrival. The dates may fall at any time, before or after the event.
export function validateTravel(form) {
  const errors = {};
  if (form.travelFrom.trim().length < 2) errors.travelFrom = 'Enter the city or area you are travelling from.';
  if (!form.arrivalAt) errors.arrivalAt = 'Choose your arrival date and time.';
  if (!form.departureAt) errors.departureAt = 'Choose your departure date and time.';
  if (form.arrivalAt && form.departureAt && form.departureAt.getTime() <= form.arrivalAt.getTime())
    errors.departureAt = 'Departure must be after your arrival.';
  return errors;
}
