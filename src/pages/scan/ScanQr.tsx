import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAppStore } from '../../store';
import { ChevronLeft, Keyboard, Camera, AlertCircle } from 'lucide-react';

export default function ScanQr() {
  const navigate = useNavigate();
  const { equipments } = useAppStore();
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const handleQrSuccess = useCallback((code: string) => {
    const eq = equipments.find((e) => e.id.toUpperCase() === code.trim().toUpperCase());
    if (eq) {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          navigate(`/inspecionar?id=${eq.id}`);
        }).catch(() => {
          navigate(`/inspecionar?id=${eq.id}`);
        });
      } else {
        navigate(`/inspecionar?id=${eq.id}`);
      }
    } else {
      setErrorMsg(`Equipamento "${code}" não cadastrado no inventário.`);
    }
  }, [equipments, navigate]);

  useEffect(() => {
    // Initialize html5-qrcode scanner
    const html5QrcodeId = 'qr-reader';
    scannerRef.current = new Html5Qrcode(html5QrcodeId);

    // Start camera scan
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
    }).catch((err) => {
      console.warn('Erro ao acessar a câmera:', err);
      setCameraPermission(false);
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

  return (
    <div className="space-y-4 sm:space-y-6">
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

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm font-bold text-critical flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* QR scanner viewport — takes 3 cols on lg */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-square max-w-md mx-auto lg:max-w-none flex flex-col items-center justify-center border border-gray-800">
            <div id="qr-reader" className="w-full h-full" />

            {cameraPermission && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="w-56 h-56 sm:w-64 sm:h-64 border-4 border-primary rounded-xl relative">
                  <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr" />
                  <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl" />
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br" />
                  <div className="absolute left-0 right-0 h-0.5 bg-primary/80 top-1/2 animate-pulse shadow-[0_0_8px_#DC2626]" />
                </div>
              </div>
            )}

            {cameraPermission === false && (
              <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center text-center p-6 gap-3 text-white z-20">
                <Camera className="w-12 h-12 text-gray-400" />
                <h4 className="font-bold text-sm">Sem Acesso à Câmera</h4>
                <p className="text-xs text-gray-400 max-w-xs">
                  Conceda permissão nas configurações ou digite o código de identificação do equipamento manualmente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Side panel — manual input + simulation */}
        <div className="lg:col-span-2 space-y-4">
          <button
            onClick={handleManualInput}
            className="btn-primary"
          >
            <Keyboard className="w-5 h-5" />
            Digitar código manualmente
          </button>

          <div className="card-subtle bg-white space-y-3">
            <span className="label-uppercase block">Simulação (IDs cadastrados)</span>
            <p className="text-xs text-gray-500 leading-relaxed">
              Use os botões abaixo para simular a leitura de um QR Code — útil em ambientes de teste.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {equipments.slice(0, 6).map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => handleQrSuccess(eq.id)}
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-left font-bold text-xs hover:bg-gray-100 hover:border-gray-300 min-h-0 transition-all"
                >
                  <div className="text-gray-800 truncate">{eq.id}</div>
                  <div className="text-[10px] text-gray-500 font-medium truncate">{eq.tipo}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
