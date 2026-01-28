import { useState, useRef, useCallback } from 'react';

interface HybridRecorderState {
  isRecording: boolean;
  recordingTime: number; // seconds
  error: string | null;
  fileHandle: any | null; // FileSystemFileHandle
}

export const useHybridRecorder = (stream: MediaStream | null) => {
  const [status, setStatus] = useState<HybridRecorderState>({
    isRecording: false,
    recordingTime: 0,
    error: null,
    fileHandle: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileWritableRef = useRef<any>(null); // FileSystemWritableFileStream
  const uploadBufferRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // SIMULATED Cloud Upload Service
  const uploadChunkToCloud = async (blob: Blob, index: number) => {
    // In production, this would use fetch/axios to POST to S3/GCP signed URL
    console.log(`[Cloud] Uploading chunk #${index} (${blob.size} bytes)...`);
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network latency
    console.log(`[Cloud] Chunk #${index} secure.`);
  };

  const startRecording = useCallback(async () => {
    if (!stream) {
      setStatus(prev => ({ ...prev, error: "No media stream available" }));
      return;
    }

    try {
      // 1. Initialize Local File System Access (Chromium only)
      let fileHandle = null;
      let writable = null;
      
      try {
        // @ts-ignore - File System Access API
        if (window.showSaveFilePicker) {
            // @ts-ignore
          fileHandle = await window.showSaveFilePicker({
            suggestedName: `service-recording-${new Date().toISOString()}.webm`,
            types: [{
              description: 'WebM Video',
              accept: { 'video/webm': ['.webm'] },
            }],
          });
          writable = await fileHandle.createWritable();
          fileWritableRef.current = writable;
        } else {
          console.warn("File System Access API not supported. Falling back to memory only.");
        }
      } catch (err) {
        console.warn("User cancelled file picker or error:", err);
        // Continue recording even if local disk fails (Cloud Only Mode)
      }

      // 2. Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      let chunkIndex = 0;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Path A: Write to Local Disk
          if (fileWritableRef.current) {
            try {
              await fileWritableRef.current.write(event.data);
            } catch (e) {
              console.error("Disk Write Error:", e);
            }
          }

          // Path B: Cloud Upload
          // Clone the blob for upload
          const chunk = event.data;
          uploadChunkToCloud(chunk, chunkIndex++);
        }
      };

      mediaRecorder.start(1000); // Slice every 1 second for safety

      mediaRecorderRef.current = mediaRecorder;
      
      // Timer
      timerRef.current = window.setInterval(() => {
        setStatus(prev => ({ ...prev, recordingTime: prev.recordingTime + 1 }));
      }, 1000);

      setStatus({
        isRecording: true,
        recordingTime: 0,
        error: null,
        fileHandle: fileHandle,
      });

    } catch (err: any) {
      setStatus(prev => ({ ...prev, error: err.message }));
    }
  }, [stream]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && status.isRecording) {
      mediaRecorderRef.current.stop();
      
      if (timerRef.current) clearInterval(timerRef.current);

      // Close file stream
      if (fileWritableRef.current) {
        try {
          await fileWritableRef.current.close();
        } catch (e) {
            console.error("Error closing file", e);
        }
      }

      setStatus(prev => ({ ...prev, isRecording: false }));
      console.log("[HybridRecorder] Recording stopped. Local file finalized.");
    }
  }, [status.isRecording]);

  return {
    isRecording: status.isRecording,
    recordingTime: status.recordingTime,
    error: status.error,
    startRecording,
    stopRecording
  };
};