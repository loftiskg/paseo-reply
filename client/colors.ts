type RGB = [number, number, number];

export function opaqueRgb(value: string): RGB | null {
  const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  if (!match || (match[4] !== undefined && Number(match[4]) !== 1)) return null;
  const channels = match.slice(1, 4).map(Number);
  return channels.every(n => n >= 0 && n <= 255) ? channels as RGB : null;
}

function luminance(rgb: RGB): number {
  const linear = rgb.map(channel => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function contrast(a: RGB, b: RGB): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function readablePalette(background: string, inheritedText: string, prefersDark: boolean) {
  const base = opaqueRgb(background) ?? (prefersDark ? [25, 28, 25] : [255, 255, 255]) as RGB;
  const light: RGB = [235, 237, 235], dark: RGB = [32, 35, 34];
  const fallback = contrast(light, base) > contrast(dark, base) ? light : dark;
  const inherited = opaqueRgb(inheritedText);
  // Paseo's View wrapper can inherit browser-default black while nested Text is white.
  // Only trust its text color if it remains readable on the elevated popup surface.
  const surface = (fg: RGB) => base.map((v, i) => v * 0.94 + fg[i] * 0.06) as RGB;
  const foreground = inherited && contrast(inherited, surface(inherited)) >= 7 ? inherited : fallback;
  const css = (rgb: RGB) => `rgb(${rgb.join(", ")})`;
  return { background: css(base), foreground: css(foreground), scheme: fallback === light ? "dark" : "light" };
}
