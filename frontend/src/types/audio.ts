export interface AudioInfo {
  fileId: string;
  durationSec: number;
  sampleRate: number;
  format: string;
}

export type Instrument = "violin" | "piano" | "guitar";