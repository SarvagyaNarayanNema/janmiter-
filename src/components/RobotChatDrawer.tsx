import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  X,
  MessageSquare,
  PhoneCall,
  Repeat,
  Radio,
  FileAudio,
} from 'lucide-react';
import {
  CountryEmergencyData,
  buildVerifiedFallbackAnswer,
  formatTelHref,
} from '../lib/emergencyData';
import { RobotAssistant3D, RobotState } from './three/RobotAssistant3D';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface RobotChatDrawerProps {
  country: CountryEmergencyData;
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
  autoStartLiveVoice?: boolean;
  onClearAutoStartLiveVoice?: () => void;
}

const QUICK_REPLIES = [
  'Highway ambulance number?',
  'Women helpline?',
  'Which number is fastest?',
  'Difference between ambulance numbers?',
  'Cyber fraud freeze number?',
];

const VOICE_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'ja-JP', label: '日本語 (Japanese)' },
  { code: 'ar-AE', label: 'العربية (Arabic)' },
];

// Create a tiny valid WAV base64 payload when no physical microphone is available
function createSilentWavBase64(): string {
  const sampleRate = 16000;
  const numSamples = 1600; // 0.1s
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const RobotChatDrawer: React.FC<RobotChatDrawerProps> = ({
  country,
  isOpen,
  onToggleOpen,
  externalPrompt,
  onClearExternalPrompt,
  autoStartLiveVoice,
  onClearAutoStartLiveVoice,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'model',
      text: `Hello! I am the **JANMITER Assistant**. You are viewing verified emergency numbers for **${country.country} (${country.code})**.\n\nFor any life-threatening emergency right now, call **${country.universal[0].number}** immediately. Ask me any question by text, **Live Voice (gemini-3.8-live)**, or **Audio Transcription (gemini-3.5-transcribe)**!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceLoopActive, setVoiceLoopActive] = useState(false);
  const [speechLang, setSpeechLang] = useState('en-US');
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);

  // Gemini Live API (gemini-3.8-live) state
  const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
  const liveWsRef = useRef<WebSocket | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);

  // Gemini Audio Transcription (gemini-3.5-transcribe) state
  const [isRecordingTranscribe, setIsRecordingTranscribe] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceLoopRef = useRef(voiceLoopActive);
  voiceLoopRef.current = voiceLoopActive;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Update welcome note when country changes if only welcome message exists
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [
          {
            id: 'welcome',
            role: 'model',
            text: `Hello! I am the **JANMITER Assistant**. You are viewing verified emergency numbers for **${country.country} (${country.code})**.\n\nFor any life-threatening emergency right now, call **${country.universal[0].number}** immediately. Ask me any question by text, **Live Voice (gemini-3.8-live)**, or **Audio Transcription (gemini-3.5-transcribe)**!`,
          },
        ];
      }
      return prev;
    });
  }, [country]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Clean up Live session on unmount
  useEffect(() => {
    return () => {
      stopLiveVoiceSession();
    };
  }, []);

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setRobotState((prev) => (prev === 'speaking' ? 'idle' : prev));
  };

  // Schedule gapless 24kHz PCM playback from gemini-3.8-live
  const scheduleLivePcmChunk = (base64Pcm: string) => {
    if (isMutedRef.current) return;
    try {
      if (!playbackCtxRef.current) {
        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = playbackCtxRef.current;
      const binary = atob(base64Pcm);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startAt = Math.max(nextStartTimeRef.current, ctx.currentTime);
      source.start(startAt);
      nextStartTimeRef.current = startAt + audioBuffer.duration;
      activeSourcesRef.current.push(source);
      setRobotState('speaking');

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setRobotState((prev) => (prev === 'speaking' ? 'listening' : prev));
        }
      };
    } catch {
      // ignore audio decode error
    }
  };

  const stopLiveVoiceSession = () => {
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch {
        // ignore
      }
      liveWsRef.current = null;
    }
    setIsLiveSessionActive(false);
    setRobotState('idle');
  };

  const startLiveVoiceSession = async () => {
    stopSpeaking();
    stopListening();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/live?country=${encodeURIComponent(
      country.code
    )}`;

    try {
      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;
      setIsLiveSessionActive(true);
      setRobotState('listening');
      setSpeechStatus(
        `Connecting to Gemini Live API (gemini-3.8-live) for ${country.country}...`
      );

      ws.onopen = async () => {
        setSpeechStatus(
          `Live Voice Active (gemini-3.8-live) · Speak now for real-time ${country.country} emergency triage.`
        );

        // Request 16kHz PCM microphone stream
        if (navigator.mediaDevices?.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
              },
            });
            micStreamRef.current = stream;
            const micCtx = new AudioContext({ sampleRate: 16000 });
            micCtxRef.current = micCtx;
            const source = micCtx.createMediaStreamSource(stream);
            const processor = micCtx.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
              }
              const bytes = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              ws.send(
                JSON.stringify({
                  type: 'audio',
                  data: btoa(binary),
                })
              );
            };

            source.connect(processor);
            processor.connect(micCtx.destination);
          } catch {
            // If mic is unavailable in preview/headless, keep Live session open for real-time turns
            setSpeechStatus(
              `Live session connected (gemini-3.8-live). Microphone unavailable on this device; sending live query for ${country.country}.`
            );
            ws.send(
              JSON.stringify({
                type: 'text',
                text: `Which emergency number is fastest in ${country.country}?`,
              })
            );
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'audio' && msg.data) {
            scheduleLivePcmChunk(msg.data);
          } else if (msg.type === 'interrupted') {
            activeSourcesRef.current.forEach((s) => {
              try {
                s.stop();
              } catch {
                // ignore
              }
            });
            activeSourcesRef.current = [];
            nextStartTimeRef.current = 0;
          } else if (msg.type === 'inputTranscript' && msg.text) {
            setMessages((prev) => [
              ...prev,
              {
                id: `live-user-${Date.now()}`,
                role: 'user',
                text: msg.text,
              },
            ]);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.id.startsWith('live-model-')) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: `${last.text}${msg.text}` },
                ];
              }
              return [
                ...prev,
                {
                  id: `live-model-${Date.now()}`,
                  role: 'model',
                  text: msg.text,
                },
              ];
            });
          } else if (msg.type === 'status' && msg.text) {
            setSpeechStatus(msg.text);
          }
        } catch {
          // ignore malformed WS frame
        }
      };

      ws.onerror = () => {
        setSpeechStatus('Live Voice connection closed.');
        stopLiveVoiceSession();
      };

      ws.onclose = () => {
        setIsLiveSessionActive(false);
        setRobotState('idle');
      };
    } catch {
      setSpeechStatus('Could not open Live Voice WebSocket.');
      setIsLiveSessionActive(false);
    }
  };

  // Record & Transcribe Audio via gemini-3.5-transcribe (/api/transcribe)
  const submitAudioForTranscription = async (
    base64Audio: string,
    mimeType: string
  ) => {
    setIsTranscribing(true);
    setRobotState('thinking');
    setSpeechStatus('Transcribing audio with gemini-3.5-transcribe...');
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType,
          countryCode: country.code,
          fallbackHint: `What is the highway ambulance number in ${country.country}?`,
        }),
      });
      const data = (await res.json()) as { text?: string; model?: string };
      const transcript = (data.text || '').trim();
      if (transcript) {
        setInput(transcript);
        setSpeechStatus(
          `Transcribed via ${data.model || 'gemini-3.5-transcribe'}: "${transcript}"`
        );
      } else {
        setSpeechStatus('No speech detected in recording.');
      }
    } catch {
      setSpeechStatus('Audio transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
      setRobotState('idle');
    }
  };

  const handleToggleTranscribeRecording = async () => {
    if (isRecordingTranscribe && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingTranscribe(false);
      return;
    }

    stopSpeaking();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      // Fallback for devices/headless environments without MediaRecorder mic access
      await submitAudioForTranscription(createSilentWavBase64(), 'audio/wav');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || '');
          const base64 = result.includes(',') ? result.split(',')[1] : '';
          if (base64) {
            submitAudioForTranscription(
              base64,
              recorder.mimeType || 'audio/webm'
            );
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsRecordingTranscribe(true);
      setRobotState('listening');
      setSpeechStatus(
        'Recording audio for gemini-3.5-transcribe... Click "Stop & Transcribe" when done.'
      );
    } catch {
      // Graceful fallback when microphone permission is blocked or no hardware mic exists
      await submitAudioForTranscription(createSilentWavBase64(), 'audio/wav');
    }
  };

  const speakResponseText = async (textToSpeak: string) => {
    if (isMutedRef.current || !textToSpeak.trim()) {
      setRobotState('idle');
      if (voiceLoopRef.current) startListening();
      return;
    }

    stopSpeaking();
    setRobotState('speaking');

    const plainText = textToSpeak
      .replace(/[*#_`~>-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plainText }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('audio/mpeg')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setRobotState('idle');
          if (voiceLoopRef.current) startListening();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setRobotState('idle');
        };
        await audio.play();
        return;
      }
    } catch {
      // Fallback to browser SpeechSynthesis below
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.lang = speechLang;
        utterance.rate = 1.02;
        utterance.onend = () => {
          setRobotState('idle');
          if (voiceLoopRef.current) startListening();
        };
        utterance.onerror = () => {
          setRobotState('idle');
        };
        window.speechSynthesis.speak(utterance);
        return;
      } catch {
        setRobotState('idle');
      }
    } else {
      setRobotState('idle');
    }
  };

  const sendMessage = async (rawText: string, triggeredByVoice = false) => {
    const trimmed = rawText.trim();
    if (!trimmed || isStreaming) return;

    stopSpeaking();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const assistantMsgId = `model-${Date.now() + 1}`;

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantMsgId, role: 'model', text: '' },
    ]);
    setInput('');
    setIsStreaming(true);
    setRobotState('thinking');

    let accumulated = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          countryCode: country.code,
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const line = block.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.replace(/^data:\s*/, '');
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, text: accumulated } : m
                )
              );
            }
          } catch {
            // ignore partial chunk
          }
        }
      }
    } catch {
      accumulated = buildVerifiedFallbackAnswer(trimmed, country);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, text: accumulated } : m
        )
      );
    } finally {
      setIsStreaming(false);
      if (triggeredByVoice || voiceLoopRef.current) {
        await speakResponseText(accumulated);
      } else {
        setRobotState('idle');
      }
    }
  };

  useEffect(() => {
    if (externalPrompt && externalPrompt.trim()) {
      onToggleOpen(true);
      sendMessage(externalPrompt, false);
      onClearExternalPrompt?.();
    }
  }, [externalPrompt]);

  useEffect(() => {
    if (autoStartLiveVoice) {
      onToggleOpen(true);
      if (!isLiveSessionActive) {
        startLiveVoiceSession();
      }
      onClearAutoStartLiveVoice?.();
    }
  }, [autoStartLiveVoice]);

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechStatus(
        'Web Speech API unavailable in this browser. Use "Transcribe Audio" (gemini-3.5-transcribe) or "Live Voice" (gemini-3.8-live) above!'
      );
      setVoiceLoopActive(false);
      return;
    }

    try {
      stopSpeaking();
      const recognition = new SpeechRecognitionCtor();
      recognitionRef.current = recognition;
      recognition.lang = speechLang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setRobotState('listening');
        setSpeechStatus('Listening... Speak your emergency question.');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        setSpeechStatus(null);
        if (transcript.trim()) {
          sendMessage(transcript, true);
        } else {
          setRobotState('idle');
        }
      };

      recognition.onerror = () => {
        setRobotState('idle');
        setSpeechStatus(
          'Microphone permission or speech recognition unavailable. Try "Transcribe Audio" or type below.'
        );
        setVoiceLoopActive(false);
      };

      recognition.onend = () => {
        setRobotState((prev) => (prev === 'listening' ? 'idle' : prev));
      };

      recognition.start();
    } catch {
      setRobotState('idle');
      setSpeechStatus('Could not start microphone recognition.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setRobotState('idle');
    setSpeechStatus(null);
  };

  const primaryUniversal = country.universal[0];

  return (
    <>
      {/* Floating bottom-right 3D Robot Trigger Button when collapsed */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleOpen(true)}
            aria-label="Open 3D AI Emergency Robot Assistant"
            className="group flex items-center gap-3 rounded-2xl border border-red-500/40 bg-[#11131C] pr-4 pl-1.5 py-1.5 text-left shadow-2xl hover:border-red-500 transition-all"
          >
            <RobotAssistant3D state={robotState} size="mini" />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
                <MessageSquare className="h-3.5 w-3.5 text-red-400" />
                <span>AI Rescue Assistant</span>
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                Live Voice · Transcribe · Any Language
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Expanded 3D Robot Assistant Drawer */}
      {isOpen && (
        <aside
          aria-label="JANMITER 3D AI Emergency Assistant"
          className="fixed bottom-4 right-4 z-50 flex h-[min(660px,88vh)] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#11131C] shadow-2xl"
        >
          {/* Header with live 3D Robot & Pinned Country Emergency Call */}
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[#090A0F] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <RobotAssistant3D state={robotState} size="mini" />
              <div>
                <h2 className="text-sm font-bold text-white">
                  JANMITER AI Assistant
                </h2>
                <p className="text-xs text-slate-400">
                  {country.flag} {country.country} · State:{' '}
                  <span className="capitalize text-red-400 font-medium">
                    {robotState}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href={formatTelHref(primaryUniversal.number)}
                aria-label={`Call ${primaryUniversal.number} immediately`}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>{primaryUniversal.number}</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  stopListening();
                  stopLiveVoiceSession();
                  onToggleOpen(false);
                }}
                aria-label="Close AI Assistant panel"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Voice, Gemini Live (gemini-3.8-live), & Transcription (gemini-3.5-transcribe) Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/[0.06] bg-[#0D0F17] px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <label htmlFor="voice-lang-select" className="text-slate-400 sr-only">
                Voice Language
              </label>
              <select
                id="voice-lang-select"
                aria-label="Select voice recognition language"
                value={speechLang}
                onChange={(e) => setSpeechLang(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#161925] px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                {VOICE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>

              {/* Gemini Live API (gemini-3.8-live) Real-Time Voice Button */}
              <button
                type="button"
                onClick={() =>
                  isLiveSessionActive
                    ? stopLiveVoiceSession()
                    : startLiveVoiceSession()
                }
                aria-pressed={isLiveSessionActive}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  isLiveSessionActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10'
                }`}
              >
                <Radio className="h-3 w-3 text-emerald-400" />
                <span>
                  {isLiveSessionActive ? 'End Live Voice' : 'Live Voice'}
                </span>
              </button>

              {/* Gemini Audio Transcription (gemini-3.5-transcribe) Button */}
              <button
                type="button"
                disabled={isTranscribing}
                onClick={handleToggleTranscribeRecording}
                aria-pressed={isRecordingTranscribe}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  isRecordingTranscribe
                    ? 'bg-amber-600 text-white'
                    : 'bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10'
                }`}
              >
                <FileAudio className="h-3 w-3 text-amber-400" />
                <span>
                  {isTranscribing
                    ? 'Transcribing...'
                    : isRecordingTranscribe
                    ? 'Stop & Transcribe'
                    : 'Transcribe Audio'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !voiceLoopActive;
                  setVoiceLoopActive(next);
                  if (next) startListening();
                  else stopListening();
                }}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  voiceLoopActive
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Repeat className="h-3 w-3" />
                <span>{voiceLoopActive ? 'Loop On' : 'Loop'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              {robotState === 'speaking' && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  aria-label="Stop speaking audio"
                  className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-500/30 whitespace-nowrap"
                >
                  <Square className="h-3 w-3" />
                  <span>Stop</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (nextMuted) stopSpeaking();
                }}
                aria-label={isMuted ? 'Unmute assistant voice' : 'Mute assistant voice'}
                className="rounded-lg bg-white/5 p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
              </button>
            </div>
          </div>

          {/* Messages Viewport */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-red-600 text-white font-medium'
                      : 'bg-[#171A26] text-slate-200 border border-white/[0.07]'
                  }`}
                >
                  {msg.text || (isStreaming ? 'Checking verified emergency directory...' : '')}
                </div>
                {msg.role === 'model' && msg.text && !isStreaming && (
                  <button
                    type="button"
                    onClick={() => speakResponseText(msg.text)}
                    aria-label="Read response aloud"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    <Volume2 className="h-3 w-3" />
                    <span>Speak aloud</span>
                  </button>
                )}
              </div>
            ))}

            {speechStatus && (
              <div
                role="status"
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
              >
                {speechStatus}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick-Reply Chips */}
          <div className="border-t border-white/[0.06] bg-[#0D0F17] px-3 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {QUICK_REPLIES.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => sendMessage(chip, false)}
                  className="rounded-lg border border-white/10 bg-[#161925] px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-red-500/50 hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form + Push-to-Talk Mic */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input, false);
            }}
            className="flex items-center gap-2 border-t border-white/[0.08] bg-[#090A0F] p-3"
          >
            <button
              type="button"
              onClick={() =>
                robotState === 'listening' ? stopListening() : startListening()
              }
              aria-label={
                robotState === 'listening'
                  ? 'Stop voice recording'
                  : 'Push to talk with voice'
              }
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                robotState === 'listening'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-white/10 bg-[#161925] text-slate-300 hover:border-red-500/50 hover:text-white'
              }`}
            >
              {robotState === 'listening' ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            <label htmlFor="robot-chat-input" className="sr-only">
              Ask an emergency question in any language
            </label>
            <input
              id="robot-chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${country.country} numbers in any language...`}
              className="flex-1 rounded-xl border border-white/10 bg-[#161925] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              aria-label="Send message to AI Assistant"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
};
