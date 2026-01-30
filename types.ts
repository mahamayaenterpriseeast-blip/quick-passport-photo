
export enum AppStep {
  UPLOAD = 1,
  SIZE_SELECT = 2,
  REMOVE_BG = 3,
  CROP = 4,
  ADJUST = 5,
  DOWNLOAD = 6
}

export interface PhotoSize {
  id: string;
  name: string;
  width: number; // in mm
  height: number; // in mm
  description: string;
}

export const PHOTO_SIZES: PhotoSize[] = [
  { id: 'passport_in_official', name: 'Indian Passport (Official)', width: 51, height: 51, description: 'Official 2 x 2 inch (51mm x 51mm)' },
  { id: 'passport_in_std', name: 'Standard (India)', width: 35, height: 45, description: 'Common 3.5cm x 4.5cm size' },
  { id: 'pan_card', name: 'PAN Card', width: 25, height: 35, description: 'Indian PAN Card standard' },
  { id: 'stamp_in', name: 'Stamp Size', width: 20, height: 25, description: 'Small official documents' },
  { id: '3r', name: '3R Photo', width: 89, height: 127, description: '3.5" x 5" standard print' },
  { id: '4r', name: '4R Photo', width: 102, height: 152, description: '4" x 6" standard print' },
  { id: '5r', name: '5R Photo', width: 127, height: 178, description: '5" x 7" standard print' },
];

export interface ImageState {
  original: string | null;
  noBg: string | null;
  cropped: string | null;
  final: string | null;
}

export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}
