/**
 * REQUESTED DATABASE SCHEMA (PRISMA REPRESENTATION)
 * 
 * model Session {
 *   id        String   @id @default(uuid())
 *   title     String
 *   date      DateTime @default(now())
 *   hostId    String
 *   slides    Slide[]
 * }
 * 
 * model Slide {
 *   id        String   @id @default(uuid())
 *   sessionId String
 *   session   Session  @relation(fields: [sessionId], references: [id])
 *   order     Int
 *   type      SlideType
 *   content   Json     // Stores specific data based on type (Scripture, Lyrics, Media)
 *   notes     String?  // Private notes for leaders
 * }
 * 
 * enum SlideType {
 *   SCRIPTURE
 *   LYRICS
 *   MEDIA
 * }
 */

export enum SlideType {
  SCRIPTURE = 'SCRIPTURE',
  LYRICS = 'LYRICS',
  MEDIA = 'MEDIA'
}

export interface ScripturePage {
  id: string;
  book: string;
  chapter: string;
  verses: string; // e.g., "1-3"
  textPrimary: string; // Persian
  textSecondary: string; // English
}

export interface SlideContentScripture {
  pages: ScripturePage[];
}

export interface SlideContentLyrics {
  title: string;
  lines: string[];
  chords?: string; // Hidden metadata for leaders/musicians
  audioUrl?: string; // Backing track or recording
}

export interface SlideContentMedia {
  url: string;
  mediaType: 'image' | 'video' | 'audio';
  isLoop?: boolean;
  isAutoPlay?: boolean;
}

export type SlideContent = SlideContentScripture | SlideContentLyrics | SlideContentMedia;

export interface Slide {
  id: string;
  order: number;
  type: SlideType;
  content: SlideContent;
  notes?: string;
}

export interface Session {
  id: string;
  title: string;
  date: Date;
  slides: Slide[];
}

export interface DeviceStatus {
  audio: boolean;
  video: boolean;
  network: 'good' | 'poor' | 'offline';
  latencyMs: number;
}

export interface LowerThirdItem {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string; // Profile picture or icon
}

export interface PrayerRequest {
  id: string;
  name: string;
  content: string;
}

export interface DonationItem {
  id: string;
  title: string;
  description: string;
  url: string; // For QR Code
  duration: number; // Seconds to display
}

export type BroadcastLayout = 'FULL_CAM' | 'PIP' | 'SPLIT';
export type LowerThirdSize = 'small' | 'standard' | 'large' | 'xl';

export interface BroadcastOverlayConfig {
  // Global
  layout: BroadcastLayout;
  
  // Branding
  logoUrl: string | null;
  showLogo: boolean;
  
  // Lower Thirds (Info Overlay)
  lowerThirds: LowerThirdItem[];
  activeLowerThirdIndex: number;
  showLowerThird: boolean;
  lowerThirdSize: LowerThirdSize;
  
  // Rotation Logic
  isRotating: boolean;
  rotationInterval: number; // Seconds

  // Prayer Wall
  prayerRequests: PrayerRequest[];
  showPrayerTicker: boolean;

  // Donations / QR
  donations: DonationItem[];
  activeDonationId: string | null; // ID of the currently showing donation
  donationDisplayMode: 'OVERLAY' | 'FULLSCREEN';
}