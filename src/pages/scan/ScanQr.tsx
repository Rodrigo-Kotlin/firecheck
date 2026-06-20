import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAppStore } from '../../store';
import {
  ChevronLeft,
  Keyboard,
  CameraOff,
  ScanLine,
  CheckCircle2,
  ShieldAlert,
  XCircle,
  RotateCcw,
  RefreshCw,
  Beaker,
} from 'lucide-react';
import type { Equipment } from '../../types';
import { normalizeTag } from '../../utils/tagGenerator';

type ScanResult =
  | { kind: 'success'; eq: Equipment }
  | { kind: 'not-found'; code: string }
  | null;

export default function ScanQr() {
  const navigate = useNavigate();
  const { equipments } = useAppStore();
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanResultRef = useRef<ScanResult>(null);
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state so the scanner callback can read the latest
  // result without re-creating the callback (and re-running the camera effect).
  useEffect(() => {
    scanResultRef.current = scanResult;
  }, [scanResult]);

  // Clear pending navigation timeout on unmount.
  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) clearTimeout(navigateTimeoutRef.current);
    };
  }, []);

  const handleQrSuccess = useCallback((code: string) => {
    // Prevent re-scanning the same code while a not-found overlay is showing.
    const current = scanResultRef.current;
    if (current?.kind === 'not-found' && current.code === code) return;

    const normalizedCode = normalizeTag(code);
    const eq = equipments.find(
      (e) => !e.pendingDelete && !e.deletedAt && (e.id === normalizedCode || e.qrCode === normalizedCode || e.qrcode === normalizedCode),
    );
    if (eq) {
      setScanResult({ kind: 'success', eq });
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      navigateTimeoutRef.current = setTimeout(() => {
        navigate(`/inspecionar?id=${eq.id}`);
      }, 1000);
    } else {
      setScanResult({ kind: 'not-found', code });
    }
  }, [equipments, navigate]);

  useEffect(() => {
    const html5QrcodeId = 'qr-reader';
    scannerRef.current = new Html5Qrcode(html5QrcodeId);

    scannerRef.current.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (qrCodeMessage) => {
        handleQrSuccess(qrCodeMessage);
      },
      () => {
        // Silent error handler (polling fails)
      }
    ).then(() => {
      setCameraPermission(true);
    }).catch(async (err) => {
      console.warn('Erro ao acessar a câmera:', err);
      setCameraPermission(false);
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setPermissionState(result.state);
        result.onchange = () => setPermissionState(result.state);
      } catch {
        setPermissionState('prompt');
      }
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((err) => console.error('Erro ao parar scanner:', err));
      }
    };
  }, [handleQrSuccess]);

  const handleManualInput = () => {
    navigate('/inspecionar');
  };

  const dismissScanResult = () => {
    setScanResult(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <header className="page-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Inspeção</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Escaneamento de QR Code
          </h1>
        </div>
      </header>

      {/* Instructions */}
      <div className="card-subtle bg-white p-4 sm:p-5 flex items-start gap-3">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <ScanLine className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-black text-gray-900">Escaneie o QR Code do equipamento</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-relaxed">
            Aponte a câmera para o código. A identificação é automática.
          </p>
        </div>
      </div>

      {/* Scanner + Side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Scanner viewport */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-square max-w-md mx-auto lg:max-w-none flex flex-col items-center justify-center border-2 border-gray-800 shadow-xl">
            <div id="qr-reader" className="w-full h-full" />

            {/* Status badge — only when actively scanning */}
            {cameraPermission && !scanResult && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">Escaneando</span>
              </div>
            )}

            {/* Corner brackets — only when actively scanning */}
            {cameraPermission && !scanResult && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72">
                  <div
                    className="absolute -top-1 -left-1 w-10 h-10 border-t-[5px] border-l-[5px] border-primary rounded-tl-xl"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.6))' }}
                  />
                  <div
                    className="absolute -top-1 -right-1 w-10 h-10 border-t-[5px] border-r-[5px] border-primary rounded-tr-xl"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.6))' }}
                  />
                  <div
                    className="absolute -bottom-1 -left-1 w-10 h-10 border-b-[5px] border-l-[5px] border-primary rounded-bl-xl"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.6))' }}
                  />
                  <div
                    className="absolute -bottom-1 -right-1 w-10 h-10 border-b-[5px] border-r-[5px] border-primary rounded-br-xl"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.6))' }}
                  />
                  {/* Animated scan line */}
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-primary top-1/2 animate-pulse"
                    style={{ boxShadow: '0 0 8px #DC2626' }}
                  />
                </div>
              </div>
            )}

            {/* Success overlay — shown briefly before navigating */}
            {scanResult?.kind === 'success' && (
              <div className="absolute inset-0 bg-success/95 flex flex-col items-center justify-center text-center p-6 gap-3 text-white z-20">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-12 h-12 text-success" strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="font-black text-lg">Equipamento Encontrado!</h4>
                  <p className="font-mono text-sm mt-1.5 opacity-90">{scanResult.eq.id}</p>
                  <p className="text-xs opacity-75 mt-0.5">{scanResult.eq.tipo}</p>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-75 mt-2">Abrindo inspeção...</p>
              </div>
            )}

            {/* Not-found overlay — scanner keeps running, user dismisses to retry */}
            {scanResult?.kind === 'not-found' && (
              <div className="absolute inset-0 bg-critical/95 flex flex-col items-center justify-center text-center p-6 gap-3 text-white z-20">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <XCircle className="w-12 h-12 text-critical" strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="font-black text-lg">Código Não Cadastrado</h4>
                  <p className="font-mono text-sm mt-1.5 opacity-90 break-all">&ldquo;{scanResult.code}&rdquo;</p>
                  <p className="text-xs opacity-75 mt-1 max-w-xs">Este código não foi encontrado no inventário atual.</p>
                </div>
                <button
                  type="button"
                  onClick={dismissScanResult}
                  className="flex items-center justify-center gap-1.5 px-4 h-10 bg-white/10 border border-white/30 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all mt-2 min-h-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Camera error overlay */}
            {cameraPermission === false && permissionState === 'denied' ? (
              <div className="absolute inset-0 bg-gray-900/95 flex flex-col items-center justify-center text-center p-6 gap-4 text-white z-20">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-black text-base">Permissão Negada</h4>
                  <p className="text-xs text-gray-400 max-w-xs mt-1.5 leading-relaxed">
                    O acesso à câmera foi bloqueado pelo navegador. Siga os passos:
                  </p>
                </div>
                <div className="text-left text-xs text-gray-300 max-w-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-black text-amber-400 min-w-5">1.</span>
                    <span>Clique no ícone de cadeado ou câmera na barra de endereço</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-black text-amber-400 min-w-5">2.</span>
                    <span>Altere a permissão para <strong className="text-white">&ldquo;Permitir&rdquo;</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-black text-amber-400 min-w-5">3.</span>
                    <span>Recarregue a página e tente novamente</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={handleManualInput}
                    className="flex items-center justify-center gap-1.5 px-4 h-10 bg-white text-gray-800 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-gray-100 transition-all min-h-0"
                  >
                    <Keyboard className="w-4 h-4" />
                    Digitar código
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex items-center justify-center gap-1.5 px-4 h-10 bg-white/10 border border-white/30 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-all min-h-0"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Recarregar
                  </button>
                </div>
              </div>
            ) : cameraPermission === false && (
              <div className="absolute inset-0 bg-gray-900/95 flex flex-col items-center justify-center text-center p-6 gap-4 text-white z-20">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                  <CameraOff className="w-8 h-8 text-gray-300" />
                </div>
                <div>
                  <h4 className="font-black text-base">Câmera Indisponível</h4>
                  <p className="text-xs text-gray-400 max-w-xs mt-1.5 leading-relaxed">
                    Não conseguimos acessar a câmera. Verifique as permissões do navegador ou use a entrada manual abaixo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleManualInput}
                  className="flex items-center justify-center gap-1.5 px-4 h-10 bg-white text-gray-800 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-gray-100 transition-all min-h-0"
                >
                  <Keyboard className="w-4 h-4" />
                  Digitar código
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Manual input */}
          <div className="card-subtle bg-white space-y-3">
            <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <h2 className="label-uppercase">Entrada Manual</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Sem câmera disponível? Digite o código de identificação do equipamento.
            </p>
            <button
              type="button"
              onClick={handleManualInput}
              className="btn-primary btn-auto w-full"
            >
              <Keyboard className="w-4 h-4" />
              Digitar código
            </button>
          </div>

          {/* Simulation */}
          <div className="card-subtle bg-white space-y-3">
            <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
                <Beaker className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <h2 className="label-uppercase">Simulação</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              IDs cadastrados para teste em ambiente de desenvolvimento:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {equipments.slice(0, 6).map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => handleQrSuccess(eq.id)}
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-left hover:bg-gray-100 hover:border-gray-300 min-h-0 transition-all"
                >
                  <div className="font-mono text-xs font-extrabold text-gray-800 truncate">{eq.id}</div>
                  <div className="text-[10px] text-gray-500 font-medium truncate mt-0.5">{eq.tipo}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
