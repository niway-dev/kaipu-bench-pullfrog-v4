// CSS Color 4 reference math, independent of Chromium and ColorSync.
// Display P3 (8-bit encoded) -> linear P3 -> XYZ D65 -> linear sRGB -> sRGB 8-bit.
const P3_TO_XYZ = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0.0, 0.04511338185890264, 1.043944368900976],
];
const XYZ_TO_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
// sRGB and Display P3 share this transfer function.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

// Returns { rgb: clipped 8-bit sRGB, oog: true when any linear channel is outside [0,1] by
// more than half an 8-bit step (rounding noise at the gamut edge is not "out of gamut"). }
function p3ToSrgb(p3) {
  const lin = mul(
    XYZ_TO_SRGB,
    mul(
      P3_TO_XYZ,
      p3.map((v) => toLinear(v / 255)),
    ),
  );
  const eps = 0.0005;
  const oog = lin.some((c) => c < -eps || c > 1 + eps);
  const rgb = lin.map((c) =>
    Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, c))))) * 255),
  );
  return { rgb, oog };
}

module.exports = { p3ToSrgb };
