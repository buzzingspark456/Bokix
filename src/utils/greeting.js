/**
 * Delad hälsnings-util — tidsgränserna ska bestämmas på ett enda ställe,
 * inte upprepas inline i varje komponent som vill hälsa användaren
 * välkommen efter tid på dygnet.
 *
 * Morgon: före 10, eftermiddag: 10–17, kväll: efter 17.
 */
export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 10) return { greeting: 'God morgon', timeOfDay: 'morning' };
  if (hour < 17) return { greeting: 'God eftermiddag', timeOfDay: 'afternoon' };
  return { greeting: 'God kväll', timeOfDay: 'evening' };
}
