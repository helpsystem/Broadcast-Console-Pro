import React, { useState, useEffect, useRef } from 'react';
import { DeviceStatus } from '../types';

interface PreFlightCheckProps {
  onComplete: (stream: MediaStream) => void;
}

export const PreFlightCheck: React.FC<PreFlightCheckProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'good' | 'poor'>('checking');
  const [latency, setLatency] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number>();

  // Step 1: Enumerate Devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); // Request perms
        const devs = await navigator.mediaDevices.enumerateDevices();
        setDevices(devs);
        
        const cams = devs.filter(d => d.kind === 'videoinput');
        const mics = devs.filter(d => d.kind === 'audioinput');
        
        if (cams.length > 0) setSelectedCam(cams[0].deviceId);
        if (mics.length > 0) setSelectedMic(mics[0].deviceId);
      } catch (e) {
        console.error("Permission denied", e);
      }
    };
    getDevices();
  }, []);

  // Step 2: Initialize Stream when selection changes
  useEffect(() => {
    if (!selectedCam || !selectedMic) return;

    const startStream = async () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedCam }, width: 1280, height: 720 },
        audio: { deviceId: { exact: selectedMic } }
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // Audio Analysis
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(newStream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(avg);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    };

    startStream();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [selectedCam, selectedMic]);

  // Step 3: Network Check (Download & Upload)
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        // 1. Download Test (GET small JSON)
        const dlStart = Date.now();
        await fetch('https://jsonplaceholder.typicode.com/todos/1', { cache: 'no-store' });
        const dlEnd = Date.now();
        const dlTime = dlEnd - dlStart;

        // 2. Upload Test (POST small payload)
        const ulStart = Date.now();
        await fetch('https://jsonplaceholder.typicode.com/posts', {
            method: 'POST',
            body: JSON.stringify({ check: 'ping' }),
            headers: { 'Content-type': 'application/json; charset=UTF-8' },
            cache: 'no-store'
        });
        const ulEnd = Date.now();
        const ulTime = ulEnd - ulStart;

        // Average Latency
        const avgMs = Math.round((dlTime + ulTime) / 2);
        setLatency(avgMs);
        setNetworkStatus(avgMs < 300 ? 'good' : 'poor');
      } catch (e) {
        console.warn("Network check error:", e);
        setNetworkStatus('poor');
      }
    };
    
    checkNetwork();
    const interval = setInterval(checkNetwork, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, []);

  const handleComplete = () => {
    if (stream) onComplete(stream);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl w-full bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
        <div className="bg-slate-900 p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-emerald-500">✈️</span> Pre-Flight System Check
          </h1>
          <p className="text-slate-400">Verify your inputs before going live.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          
          {/* Video Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">1. Video Feed</h3>
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative border-2 border-slate-600">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                {stream?.getVideoTracks()[0]?.label || 'No Camera'}
              </div>
            </div>
            <select 
              className="w-full bg-slate-700 border-none rounded p-2 text-white"
              value={selectedCam}
              onChange={(e) => setSelectedCam(e.target.value)}
            >
              {devices.filter(d => d.kind === 'videoinput').map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Audio & Network */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200">2. Audio Levels</h3>
              <div className="h-6 bg-slate-700 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full transition-all duration-75 ${audioLevel > 200 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${(audioLevel / 255) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                {audioLevel > 10 ? "Signal Detected" : "No Audio Detected"}
              </p>
              <select 
                className="w-full bg-slate-700 border-none rounded p-2 text-white"
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
              >
                {devices.filter(d => d.kind === 'audioinput').map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200">3. Network Health</h3>
              <div className="flex items-center gap-4 bg-slate-700 p-4 rounded-lg">
                <div className={`w-4 h-4 rounded-full ${networkStatus === 'good' ? 'bg-emerald-500 animate-pulse' : networkStatus === 'poor' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div>
                  <div className="font-medium text-white uppercase">{networkStatus} connection</div>
                  <div className="text-xs text-slate-400">
                    Latency (Avg): {latency > 0 ? `${latency}ms` : 'Checking...'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 flex justify-end border-t border-slate-700">
          <button 
            onClick={handleComplete}
            disabled={!stream || networkStatus === 'checking'}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg disabled:opacity-50 transition-all"
          >
            Launch Console
          </button>
        </div>
      </div>
    </div>
  );
};