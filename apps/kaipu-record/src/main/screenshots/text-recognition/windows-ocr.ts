/**
 * Windows backend of the text recognition port (ADR 0055): `Windows.Media.Ocr` driven from
 * Windows PowerShell 5.1, the same way the window list runs (`window-lister.ts`). No compiled
 * helper, so nothing extra to build, sign or ship, and no npm dependency.
 *
 * - The script is a string constant passed with `-EncodedCommand`, never a file on disk.
 * - The PNG goes to stdin as base64 text, so no copy of the screenshot is written to a
 *   temporary file and no console code page can alter its bytes.
 * - The script prints the same JSON as the macOS helper:
 *   `{"version":1,"width":W,"height":H,"words":[{text, rect, line, confidence}]}`, boxes in
 *   the oriented image's pixels, top-left origin. Windows OCR has no per-word confidence, so
 *   every word reports 1.
 * - Windows PowerShell 5.1 (`powershell.exe`) is required: PowerShell 7 (`pwsh`) cannot load
 *   WinRT types.
 */
import { spawn } from "node:child_process";
import { win32 } from "node:path";
import { z } from "zod";
import { recognizedWordsSchema } from "@kaipu/domain/schemas";
import type { RecognizedWord, TextRecognizer } from "@kaipu/domain/schemas";
import { runHelperProcess } from "./helper-process";

/**
 * PowerShell start, the WinRT type load and the first OCR on a machine. Not measured on a
 * consumer machine yet (see ADR 0055); 30 s keeps a slow first run from turning into
 * "unavailable" while still ending a hung process.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/** The script's exit code when no profile language has an OCR pack: permanent for this run. */
export const NO_OCR_LANGUAGE_EXIT_CODE = 2;

const scriptOutputSchema = z.object({
  version: z.literal(1),
  words: recognizedWordsSchema,
});

/**
 * Written for Windows PowerShell 5.1 (WinRT projection through `ContentType=WindowsRuntime`).
 * WinRT async operations are awaited through `WindowsRuntimeSystemExtensions.AsTask`.
 * - `TryCreateFromUserProfileLanguages` picks the first profile language with an installed
 *   OCR pack; none installed is an error, so the port answers "unavailable".
 * - The decoder applies the EXIF orientation, as the macOS helper does, because the renderer
 *   normalizes boxes by the displayed size.
 * - An image larger than `OcrEngine.MaxImageDimension` is scaled down for recognition and
 *   its boxes scaled back to source pixels.
 * - Errors go to stderr with exit code 1; no OCR language for the profile is exit code 2
 *   (`NO_OCR_LANGUAGE_EXIT_CODE`).
 */
export const WINDOWS_OCR_SCRIPT = String.raw`$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapTransform, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics, ContentType = WindowsRuntime]
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq ('IAsyncOperation' + [char]96 + '1')
  } | Select-Object -First 1
  function Await($operation, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
    $null = $task.Wait(-1)
    $task.Result
  }

  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if ($null -eq $engine) {
    [Console]::Error.WriteLine('no OCR language pack is installed for the user profile languages')
    exit 2
  }

  $bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
  if ($bytes.Length -eq 0) { throw 'empty input' }
  $memory = New-Object System.IO.MemoryStream(,$bytes)
  $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($memory)
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $width = [int]$decoder.OrientedPixelWidth
  $height = [int]$decoder.OrientedPixelHeight
  $transform = New-Object Windows.Graphics.Imaging.BitmapTransform
  $largest = [Math]::Max($width, $height)
  $limit = [int][Windows.Media.Ocr.OcrEngine]::MaxImageDimension
  if ($largest -gt $limit) {
    $scale = $limit / $largest
    $transform.ScaledWidth = [uint32][Math]::Max(1, [Math]::Floor($decoder.PixelWidth * $scale))
    $transform.ScaledHeight = [uint32][Math]::Max(1, [Math]::Floor($decoder.PixelHeight * $scale))
    $transform.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Fant
  }
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync(
      [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
      [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied,
      $transform,
      [Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation,
      [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $sx = $width / $bitmap.PixelWidth
  $sy = $height / $bitmap.PixelHeight
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

  $culture = [Globalization.CultureInfo]::InvariantCulture
  $escape = [System.Text.RegularExpressions.MatchEvaluator] { param($m) '\u{0:x4}' -f [int][char]$m.Value }
  function Pixel([double]$value, [int]$high) {
    ([Math]::Min([Math]::Max([Math]::Round($value), 0), $high)).ToString($culture)
  }
  $json = New-Object System.Text.StringBuilder
  $null = $json.Append('{"version":1,"width":' + $width.ToString($culture) + ',"height":' + $height.ToString($culture) + ',"words":[')
  $first = $true
  $line = 0
  foreach ($ocrLine in $result.Lines) {
    foreach ($word in $ocrLine.Words) {
      if ([string]::IsNullOrWhiteSpace($word.Text)) { continue }
      $r = $word.BoundingRect
      $x0 = Pixel ($r.X * $sx) $width
      $x1 = Pixel (($r.X + $r.Width) * $sx) $width
      $y0 = Pixel ($r.Y * $sy) $height
      $y1 = Pixel (($r.Y + $r.Height) * $sy) $height
      if (-not $first) { $null = $json.Append(',') }
      $first = $false
      $text = [regex]::Replace($word.Text, '[\u0000-\u001f"\\]', $escape)
      $null = $json.Append('{"text":"' + $text + '","rect":{"x":' + $x0 + ',"y":' + $y0 +
        ',"w":' + ([double]$x1 - [double]$x0).ToString($culture) +
        ',"h":' + ([double]$y1 - [double]$y0).ToString($culture) +
        '},"line":' + $line.ToString($culture) + ',"confidence":1}')
    }
    $line++
  }
  $null = $json.Append(']}')
  $out = [System.Text.Encoding]::UTF8.GetBytes($json.ToString())
  $stdout = [Console]::OpenStandardOutput()
  $stdout.Write($out, 0, $out.Length)
  $stdout.Flush()
  exit 0
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

/** Windows PowerShell 5.1 by absolute path, so neither `pwsh` nor a PATH entry can stand in. */
export function windowsPowerShellPath(env: NodeJS.ProcessEnv = process.env): string {
  const root = env.SystemRoot ?? env.windir;
  return root
    ? win32.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell.exe";
}

/** The arguments that run `script`; `-EncodedCommand` is base64 of UTF-16LE. */
export function windowsOcrArgs(script: string = WINDOWS_OCR_SCRIPT): string[] {
  return [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    Buffer.from(script, "utf16le").toString("base64"),
  ];
}

export interface WindowsOcrTextRecognizerOptions {
  /** Defaults to Windows PowerShell 5.1. Tests point it at another executable. */
  command?: string;
  /** Defaults to `windowsOcrArgs()`. */
  args?: string[];
  timeoutMs?: number;
  spawnImpl?: typeof spawn;
}

export class WindowsOcrTextRecognizer implements TextRecognizer {
  private readonly command: string;
  private readonly args: string[];
  private readonly timeoutMs: number;
  private readonly spawnImpl: typeof spawn;
  /**
   * Set by a failure no retry can fix in this app session (no PowerShell, no OCR language
   * pack), so later requests answer at once instead of starting PowerShell again. A timeout
   * or any other failure is retried on the next request.
   */
  private permanentlyUnavailable = false;

  constructor(options: WindowsOcrTextRecognizerOptions = {}) {
    this.command = options.command ?? windowsPowerShellPath();
    this.args = options.args ?? windowsOcrArgs();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.spawnImpl = options.spawnImpl ?? spawn;
  }

  async recognize(png: Uint8Array): Promise<RecognizedWord[] | "unavailable"> {
    if (this.permanentlyUnavailable) return "unavailable";
    try {
      const input = Buffer.from(Buffer.from(png).toString("base64"), "ascii");
      const result = await runHelperProcess({
        command: this.command,
        args: this.args,
        input,
        timeoutMs: this.timeoutMs,
        spawnImpl: this.spawnImpl,
        keepStderr: true,
      });
      if (!result.ok) {
        if (result.missing || result.exitCode === NO_OCR_LANGUAGE_EXIT_CODE) {
          this.permanentlyUnavailable = true;
        }
        return unavailable(result.reason ?? "failed");
      }
      let json: unknown;
      try {
        json = JSON.parse(result.stdout);
      } catch {
        return unavailable("output is not JSON");
      }
      const parsed = scriptOutputSchema.safeParse(json);
      if (!parsed.success) return unavailable("output does not match the schema");
      return parsed.data.words;
    } catch (error) {
      return unavailable(error instanceof Error ? error.message : "unexpected error");
    }
  }
}

function unavailable(reason: string): "unavailable" {
  console.warn(`[text-recognition] Windows OCR unavailable: ${reason}`);
  return "unavailable";
}
