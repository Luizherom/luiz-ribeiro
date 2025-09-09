import React, { useState, useCallback, useRef, useEffect } from 'react';
import { transcribeAudio } from './services/geminiService';
import { fileToBase64 } from './utils/fileHelper';

type Status = 'idle' | 'processing' | 'success' | 'error';
type RecordingStatus = 'idle' | 'recording' | 'stopped';

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V21h18v-3.75M4.5 12.75l7.5-7.5 7.5 7.5" />
  </svg>
);

const AudioFileIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
  </svg>
);

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const MicrophoneIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5a6 6 0 00-12 0v1.5a6 6 0 006 6zM12 14.25a3 3 0 003-3v-1.5a3 3 0 00-6 0v1.5a3 3 0 003 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 10.5a7.5 7.5 0 11-15 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75v.008" />
    </svg>
);


const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recording state
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [audioUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFileAndUrl(selectedFile);
    }
  };
  
  const setFileAndUrl = (file: File) => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setStatus('idle');
      setTranscription('');
      setError('');
  }

  const resetState = () => {
    setFile(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setStatus('idle');
    setTranscription('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Reset recording state
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    }
    setRecordingStatus('idle');
    setRecordingTime(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    audioChunksRef.current = [];
  }

  const handleTranscribe = useCallback(async () => {
    if (!file) {
      setError('Por favor, selecione ou grave um arquivo de áudio primeiro.');
      setStatus('error');
      return;
    }
    setStatus('processing');
    setError('');
    try {
      const { mimeType, data } = await fileToBase64(file);
      const result = await transcribeAudio({ mimeType, data });
      setTranscription(result);
      setStatus('success');
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
      setError(`Falha na transcrição: ${errorMessage}`);
      setStatus('error');
    }
  }, [file]);
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(transcription);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
            setFileAndUrl(audioFile);
            setRecordingStatus('stopped');
            stream.getTracks().forEach(track => track.stop()); // Stop microphone access
        };
        
        mediaRecorderRef.current.start();
        setRecordingStatus('recording');
        setRecordingTime(0);
        timerIntervalRef.current = window.setInterval(() => {
            setRecordingTime(prevTime => prevTime + 1);
        }, 1000);

    } catch (err) {
        console.error("Error starting recording:", err);
        setError("Não foi possível acessar o microfone. Verifique as permissões do seu navegador.");
        setStatus('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = (time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="text-center flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent border-solid rounded-full animate-spin"></div>
            <p className="mt-4 text-lg text-gray-300">Transcrevendo áudio... Isso pode levar alguns instantes.</p>
          </div>
        );
      case 'success':
        return (
          <div className="flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-3">Transcrição Concluída:</h3>
            {audioUrl && (
              <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-2">Áudio Original:</p>
                  <audio controls src={audioUrl} className="w-full">
                      Seu navegador não suporta o elemento de áudio.
                  </audio>
              </div>
            )}
            <div className="relative flex-grow">
                <textarea
                  readOnly
                  value={transcription}
                  className="w-full h-full p-4 bg-gray-900 border border-gray-600 rounded-lg text-gray-300 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  rows={15}
                />
                <button 
                  onClick={handleCopyToClipboard}
                  className="absolute top-3 right-3 p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500"
                  aria-label="Copiar para a área de transferência"
                >
                  {isCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
                </button>
            </div>
            <button
                onClick={resetState}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
              >
                Transcrever Outro Áudio
            </button>
          </div>
        );
      case 'error':
        return (
          <div className="text-center p-6 bg-red-900/20 border border-red-500 rounded-lg">
            <h3 className="text-xl font-semibold text-red-400 mb-2">Erro</h3>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={resetState}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
            >
              Tentar Novamente
            </button>
          </div>
        );
      case 'idle':
      default:
        if (file) {
             return (
              <div className="text-center w-full flex flex-col items-center justify-center h-full">
                <AudioFileIcon className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                <p className="text-lg font-medium text-gray-300 mb-2">Áudio pronto para transcrever:</p>
                <p className="px-4 py-2 bg-gray-700 rounded-md text-gray-200 truncate mb-4 w-full max-w-sm">{file.name}</p>
                {audioUrl && (
                  <audio controls src={audioUrl} className="w-full max-w-sm mb-6">
                      Seu navegador não suporta o elemento de áudio.
                  </audio>
                )}
                <div className="flex gap-4 w-full max-w-sm">
                    <button
                        onClick={resetState}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleTranscribe}
                        disabled={status !== 'idle'}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
                    >
                        Transcrever Áudio
                    </button>
                </div>
              </div>
            );
        }

        if (recordingStatus === 'recording') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="relative mb-4">
                        <MicrophoneIcon className="w-20 h-20 text-red-500" />
                        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full animate-ping"></span>
                        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full"></span>
                    </div>
                    <p className="text-2xl font-mono text-gray-200 mb-4">{formatTime(recordingTime)}</p>
                    <p className="text-lg text-gray-400 mb-6">Gravando...</p>
                    <button
                        onClick={stopRecording}
                        className="w-full max-w-xs bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
                    >
                        Parar Gravação
                    </button>
                </div>
            );
        }

        return (
          <div className="flex flex-col items-center justify-center h-full gap-8">
                <label htmlFor="audio-upload" tabIndex={0} className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-gray-800/50 hover:bg-gray-800/80 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500">
                    <div className="flex flex-col items-center justify-center">
                        <UploadIcon className="w-10 h-10 mb-4 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Clique para enviar</span> ou arraste e solte</p>
                        <p className="text-xs text-gray-500">Qualquer formato de áudio</p>
                    </div>
                    <input ref={fileInputRef} id="audio-upload" type="file" className="hidden" accept="audio/*" onChange={handleFileChange} />
                </label>
                <div className="flex items-center w-full">
                    <hr className="flex-grow border-t border-gray-600"/>
                    <span className="px-4 text-gray-500">OU</span>
                    <hr className="flex-grow border-t border-gray-600"/>
                </div>
                <button
                    onClick={startRecording}
                    className="flex items-center justify-center gap-3 w-full p-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
                >
                    <MicrophoneIcon className="w-8 h-8"/>
                    <span className="text-lg">Gravar Áudio Agora</span>
                </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
            Transcrição de Áudio
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Grave um áudio ou envie um arquivo para obter a transcrição em segundos.
          </p>
        </header>
        <main className="bg-gray-800 shadow-2xl shadow-blue-500/10 rounded-xl p-6 sm:p-8 min-h-[450px] flex flex-col">
          <div className="sr-only" aria-live="polite" role="status">
            {/* Announce status changes for screen readers */}
            {status === 'processing' && 'Transcrevendo o áudio, por favor aguarde.'}
            {status === 'success' && 'Transcrição concluída com sucesso.'}
            {status === 'error' && `Ocorreu um erro: ${error}`}
          </div>
          {renderContent()}
        </main>
        <footer className="text-center mt-8">
            <p className="text-gray-500">Powered by Gemini API</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
