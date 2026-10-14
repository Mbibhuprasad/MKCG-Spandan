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

// Mirrors the API's rules: an origin, both moments, departure after arrival,
// arrival before the event ends and departure after it starts.
export function validateTravel(form, { startsAt, endsAt }) {
  const errors = {};
  if (form.travelFrom.trim().length < 2) errors.travelFrom = 'Enter the city or area you are travelling from.';
  if (!form.arrivalAt) errors.arrivalAt = 'Choose your arrival date and time.';
  if (!form.departureAt) errors.departureAt = 'Choose your departure date and time.';
  const start = startsAt ? new Date(startsAt).getTime() : NaN;
  const end = endsAt ? new Date(endsAt).getTime() : start;
  if (form.arrivalAt && !Number.isNaN(end) && form.arrivalAt.getTime() > end) errors.arrivalAt = 'Your arrival must be before the event ends.';
  if (form.arrivalAt && form.departureAt && !errors.arrivalAt) {
    if (form.departureAt.getTime() <= form.arrivalAt.getTime()) errors.departureAt = 'Departure must be after your arrival.';
    else if (!Number.isNaN(start) && form.departureAt.getTime() < start) errors.departureAt = 'Your departure cannot be before the event starts.';
  }
  return errors;
}
