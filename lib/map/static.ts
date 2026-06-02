/**
 * Pure helpers to frame a parcel on a static aerial image and project its
 * boundary ring onto the image's pixel grid. No I/O — fully testable.
 *
 * Approach: request the aerial in Web Mercator (EPSG:3857) for a padded bbox
 * around the parcel, then project the ring's lon/lat vertices into the same
 * mercator bbox → pixel coordinates. Because the image and the overlay share
 * one mercator extent, an SVG drawn over the <img> aligns exactly.
 *
 * Imagery: King County aerial orthos (local, public, same host as our parcel
 * data) primary; Esri World Imagery as a keyless fallback over the same bbox.
 */

const R = 20037508.342789244; // mercator half-circumference (meters)

/** King County's most recent aerial ortho year. Bump as new orthos publish. */
export const KC_AERIAL_YEAR = "2025";

export function lonToMercX(lon: number): number {
  return (lon * R) / 180;
}
export function latToMercY(lat: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return (Math.log(Math.tan(((90 + clamped) * Math.PI) / 360)) / (Math.PI / 180)) * (R / 180);
}

export interface ParcelMapView {
  /** Primary aerial (King County) and keyless fallback (Esri), same extent. */
  imageUrl: string;
  fallbackUrl: string;
  width: number;
  height: number;
  /** Ring vertices as "x,y x,y …" in image pixels — ready for <polygon>. */
  polygonPoints: string;
  /** Imagery attribution to display. */
  attribution: string;
}

const KC_EXPORT =
  `https://gismaps.kingcounty.gov/arcgis/rest/services/BaseMaps/KingCo_Aerial_${KC_AERIAL_YEAR}/MapServer/export`;
const ESRI_EXPORT =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";

function exportUrl(base: string, bbox: string, w: number, h: number): string {
  return `${base}?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${w},${h}&format=png&transparent=false&f=image`;
}

/**
 * Frame `ring` (array of [lon, lat]) on an aerial of the given pixel size.
 * Returns null for a degenerate ring. `padFrac` pads around the parcel;
 * a minimum half-extent keeps tiny parcels from over-zooming.
 */
export function buildParcelMapView(
  ring: [number, number][] | null | undefined,
  opts?: { width?: number; height?: number; padFrac?: number },
): ParcelMapView | null {
  if (!ring || ring.length < 3) return null;
  const width = opts?.width ?? 720;
  const height = opts?.height ?? 480;
  const padFrac = opts?.padFrac ?? 0.6;
  const MIN_HALF = 60; // mercator units (~40 m at this latitude)

  const xs = ring.map(([lon]) => lonToMercX(lon));
  const ys = ring.map(([, lat]) => latToMercY(lat));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  let hx = Math.max((Math.max(...xs) - Math.min(...xs)) / 2, MIN_HALF) * (1 + padFrac);
  let hy = Math.max((Math.max(...ys) - Math.min(...ys)) / 2, MIN_HALF) * (1 + padFrac);

  // Match the image aspect so the aerial isn't distorted.
  const aspect = width / height;
  if (hx / hy < aspect) hx = hy * aspect;
  else hy = hx / aspect;

  const minX = cx - hx;
  const maxX = cx + hx;
  const minY = cy - hy;
  const maxY = cy + hy;
  const bbox = `${minX},${minY},${maxX},${maxY}`;

  const polygonPoints = ring
    .map(([lon, lat]) => {
      const px = ((lonToMercX(lon) - minX) / (maxX - minX)) * width;
      const py = ((maxY - latToMercY(lat)) / (maxY - minY)) * height;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");

  return {
    imageUrl: exportUrl(KC_EXPORT, bbox, width, height),
    fallbackUrl: exportUrl(ESRI_EXPORT, bbox, width, height),
    width,
    height,
    polygonPoints,
    attribution: `Aerial: King County ${KC_AERIAL_YEAR}`,
  };
}
