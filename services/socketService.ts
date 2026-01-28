// This service simulates the WebSocket Logic requested.
// In a real app, this would use socket.io-client.

type Listener = (data: any) => void;

class MockSocketService {
  private listeners: Map<string, Listener[]> = new Map();
  private isConnected: boolean = false;

  connect() {
    console.log("[WebSocket] Connecting to signaling server...");
    setTimeout(() => {
      this.isConnected = true;
      this.emit('connect', {});
      console.log("[WebSocket] Connected.");
    }, 500);
  }

  // Simulate sending a slide update to all clients
  emitSlideChange(slideId: string) {
    if (!this.isConnected) return;
    console.log(`[WebSocket] Emitting 'slide_change': ${slideId}`);
    
    // Simulate latency and broadcast to others
    setTimeout(() => {
      // In a real app, this comes back from the server
      this.trigger('slide_change', { slideId, timestamp: Date.now() });
    }, 100);
  }

  on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Listener) {
    const subs = this.listeners.get(event);
    if (subs) {
      this.listeners.set(event, subs.filter(cb => cb !== callback));
    }
  }

  // Internal helper to trigger local listeners (simulating server message)
  private trigger(event: string, data: any) {
    const subs = this.listeners.get(event);
    if (subs) {
      subs.forEach(cb => cb(data));
    }
  }

  // Simulate helper
  private emit(event: string, data: any) {
    this.trigger(event, data);
  }
}

export const socketService = new MockSocketService();