import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

let css: string | null = null;

/** يضمّن خط IBM Plex Sans Arabic محليًا داخل HTML (لا اعتماد على الشبكة) */
export function embeddedFontCss() {
  if (css) return css;
  const dir = path.join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans-arabic/files");
  const face = (subset: string, weight: number, range: string) => {
    const b64 = readFileSync(path.join(dir, `ibm-plex-sans-arabic-${subset}-${weight}-normal.woff2`)).toString("base64");
    return `@font-face{font-family:'Plex';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range};}`;
  };
  const ar = "U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFF";
  const la = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
  css = [face("arabic", 400, ar), face("arabic", 700, ar), face("latin", 400, la), face("latin", 700, la)].join("\n");
  return css;
}
