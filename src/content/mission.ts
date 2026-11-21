/**
 * Mission page: the mission follows the account's primary web file and the center follows the mission
 * (Chittagong -> IVAC, CHITTAGONG ...). The choice cannot be changed after submission, so the confirm
 * button is only pressed when the page shows a center that belongs to the displayed mission.
 */

/** Reads the value shown under a small label, e.g. "Select a mission" -> "Chittagong" */
export function readLabelledValue(doc: Document, label: RegExp): string | null {
  for (const span of Array.from(doc.querySelectorAll('span'))) {
    if (!label.test((span.textContent ?? '').trim())) continue;
    const value = (span.nextElementSibling?.textContent ?? '').trim();
    if (value) return value;
  }
  return null;
}

export function readMissionAndCenter(doc: Document): { mission: string | null; center: string | null } {
  return {
    mission: readLabelledValue(doc, /^select a mission$/i),
    center: readLabelledValue(doc, /^select your ivac center$/i),
  };
}

/** The last word of the mission (its city) must appear in the center name */
export function centerMatchesMission(mission: string | null, center: string | null): boolean {
  if (!mission || !center) return false;
  const city = mission.toLowerCase().split(/[^a-z]+/).filter(Boolean).pop();
  return !!city && center.toLowerCase().includes(city);
}