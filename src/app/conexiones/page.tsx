"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFirebaseApp, getAuthInstance } from "@/lib/firebase";

type Status = "pending" | "ok" | "error";

type SensorKey =
  | "online"
  | "geolocation"
  | "camera"
  | "microphone"
  | "firebase"
  | "maps"
  | "gemini";

type SensorState = Record<SensorKey, Status>;

const initialState: SensorState = {
  online: "pending",
  geolocation: "pending",
  camera: "pending",
  microphone: "pending",
  firebase: "pending",
  maps: "pending",
  gemini: "pending",
};

export default function ConexionesPage() {
  const [sensors, setSensors] = useState<SensorState>(initialState);
  const [messages, setMessages] = useState<Record<SensorKey, string>>({
    online: "",
    geolocation: "",
    camera: "",
    microphone: "",
    firebase: "",
    maps: "",
    gemini: "",
  });

  useEffect(() => {
    const updateSensor = (key: SensorKey, status: Status, msg?: string) => {
      setSensors((prev) => ({ ...prev, [key]: status }));
      if (msg) {
        setMessages((prev) => ({ ...prev, [key]: msg }));
      }
    };

    // Internet
    try {
      const online = typeof navigator !== "undefined" ? navigator.onLine : false;
      updateSensor(
        "online",
        online ? "ok" : "error",
        online ? "Conectado a la red." : "Sin conexión a Internet."
      );
    } catch {
      updateSensor("online", "error", "No se pudo determinar el estado de red.");
    }

    // Helper para permissions.query con fallback
    const checkPermission = async (name: PermissionName, key: SensorKey) => {
      if (typeof navigator === "undefined") {
        updateSensor(key, "error", "Navegador no disponible.");
        return;
      }
      if (!("permissions" in navigator)) {
        updateSensor(
          key,
          "pending",
          "El navegador no expone navigator.permissions; use el botón Autorizar."
        );
        return;
      }
      try {
        const status = await (navigator.permissions as any).query({ name });
        const state = status.state as PermissionState;
        if (state === "granted") {
          updateSensor(key, "ok", "Permiso concedido.");
        } else if (state === "prompt") {
          updateSensor(
            key,
            "pending",
            "Permiso pendiente. Use el botón Autorizar para solicitarlo."
          );
        } else {
          updateSensor(
            key,
            "error",
            "Permiso denegado. Use el botón Autorizar o revise los ajustes del sistema."
          );
        }
      } catch (e) {
        console.error("[Centro de Conexiones] Error comprobando permiso", name, e);
        updateSensor(
          key,
          "pending",
          "No se pudo leer el estado del permiso. Use el botón Autorizar."
        );
      }
    };

    // GPS
    void checkPermission("geolocation" as PermissionName, "geolocation");
    // Cámara
    void checkPermission("camera" as PermissionName, "camera");
    // Micrófono
    void checkPermission("microphone" as PermissionName, "microphone");

    // Firebase (app + auth)
    try {
      const app = getFirebaseApp();
      const auth = getAuthInstance();
      const user = auth.currentUser;
      if (app) {
        updateSensor(
          "firebase",
          "ok",
          user
            ? `Firebase inicializado. Usuario: ${user.email || user.uid}.`
            : "Firebase inicializado. Sin sesión activa."
        );
      } else {
        updateSensor("firebase", "error", "No se pudo inicializar Firebase.");
      }
    } catch (e) {
      console.error("[Centro de Conexiones] Error comprobando Firebase:", e);
      updateSensor("firebase", "error", "Error al comprobar Firebase.");
    }

    // Google Maps / Gemini por variables de entorno
    try {
      const mapsKey =
        typeof process !== "undefined"
          ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          : undefined;
      updateSensor(
        "maps",
        mapsKey && mapsKey.trim().length > 0 ? "ok" : "error",
        mapsKey
          ? "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY cargada."
          : "Falta la clave NEXT_PUBLIC_GOOGLE_MAPS_API_KEY."
      );
    } catch {
      updateSensor("maps", "error", "No se pudo comprobar la configuración de Maps.");
    }

    try {
      const geminiKey =
        typeof process !== "undefined"
          ? process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY
          : undefined;
      updateSensor(
        "gemini",
        geminiKey && geminiKey.toString().trim().length > 0 ? "ok" : "error",
        geminiKey
          ? "Clave de Gemini detectada."
          : "No se detecta GEMINI_API_KEY en el entorno."
      );
    } catch {
      updateSensor("gemini", "error", "No se pudo comprobar la configuración de Gemini.");
    }
  }, []);

  const [_, setDummy] = useState(0); // evita warning por funciones no usadas

  const authorizeCamera = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      alert(
        "Este navegador no soporta acceso directo a la cámara. Use Chrome/Edge actualizados."
      );
      return;
    }
    try {
      setSensors((prev) => ({ ...prev, camera: "pending" }));
      await navigator.mediaDevices.getUserMedia({ video: true });
      setSensors((prev) => ({ ...prev, camera: "ok" }));
      setMessages((prev) => ({
        ...prev,
        camera: "Permiso de cámara concedido.",
      }));
    } catch (e) {
      console.error("[Centro de Conexiones] Error solicitando cámara:", e);
      setSensors((prev) => ({ ...prev, camera: "error" }));
      alert(
        "Permiso de cámara bloqueado por el sistema.\n\nPara reactivarlo:\n- En Android: Ajustes → Aplicaciones → Navegador (Chrome) → Permisos → Cámara → Permitir.\n- En iOS: Ajustes → Safari/Chrome → Cámara → Permitir."
      );
    }
  };

  const authorizeMicrophone = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      alert(
        "Este navegador no soporta acceso directo al micrófono. Use Chrome/Edge actualizados."
      );
      return;
    }
    try {
      setSensors((prev) => ({ ...prev, microphone: "pending" }));
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setSensors((prev) => ({ ...prev, microphone: "ok" }));
      setMessages((prev) => ({
        ...prev,
        microphone: "Permiso de micrófono concedido.",
      }));
    } catch (e) {
      console.error("[Centro de Conexiones] Error solicitando micrófono:", e);
      setSensors((prev) => ({ ...prev, microphone: "error" }));
      alert(
        "Permiso de micrófono bloqueado por el sistema.\n\nPara reactivarlo:\n- En Android: Ajustes → Aplicaciones → Navegador (Chrome) → Permisos → Micrófono → Permitir.\n- En iOS: Ajustes → Safari/Chrome → Micrófono → Permitir."
      );
    }
  };

  const authorizeGeolocation = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      alert(
        "Este navegador no soporta geolocalización o está desactivada. Use Chrome/Edge actualizados."
      );
      return;
    }
    try {
      setSensors((prev) => ({ ...prev, geolocation: "pending" }));
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 60000,
        });
      });
      setSensors((prev) => ({ ...prev, geolocation: "ok" }));
      setMessages((prev) => ({
        ...prev,
        geolocation: "Permiso de ubicación concedido.",
      }));
    } catch (e) {
      console.error("[Centro de Conexiones] Error solicitando geolocalización:", e);
      setSensors((prev) => ({ ...prev, geolocation: "error" }));
      alert(
        "Permiso de ubicación bloqueado por el sistema.\n\nPara reactivarlo:\n- En Android: Ajustes → Aplicaciones → Navegador (Chrome) → Permisos → Ubicación → Permitir.\n- En iOS: Ajustes → Safari/Chrome → Ubicación → Permitir."
      );
    }
  };

  const statusBadge = (status: Status) => {
    const base =
      "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border";
    if (status === "ok")
      return (
        <span className={`${base} border-emerald-500 bg-emerald-900/40 text-emerald-200`}>
          ● Conectado
        </span>
      );
    if (status === "error")
      return (
        <span className={`${base} border-red-500 bg-red-900/40 text-red-200`}>
          ● Fallo
        </span>
      );
    return (
      <span className={`${base} border-yellow-400 bg-yellow-900/40 text-yellow-200`}>
        ● Comprobando
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-slate-300">
                ← Volver al Lobby
              </Link>
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">
              Centro de Conexiones
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Diagnóstico táctico de hardware, red y servicios de IA antes de operar.
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-200 mb-1">
              Red y Servicios de Nube
            </h2>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">Internet / Datos</p>
                  <p className="text-xs text-slate-400">{messages.online}</p>
                </div>
                {statusBadge(sensors.online)}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">Firebase</p>
                  <p className="text-xs text-slate-400">{messages.firebase}</p>
                </div>
                {statusBadge(sensors.firebase)}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">Google Maps</p>
                  <p className="text-xs text-slate-400">{messages.maps}</p>
                </div>
                {statusBadge(sensors.maps)}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">Gemini (IA)</p>
                  <p className="text-xs text-slate-400">{messages.gemini}</p>
                </div>
                {statusBadge(sensors.gemini)}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-200 mb-1">
              Sensores del Dispositivo
            </h2>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">GPS / Ubicación</p>
                  <p className="text-xs text-slate-400">{messages.geolocation}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {statusBadge(sensors.geolocation)}
                  <button
                    type="button"
                    onClick={authorizeGeolocation}
                    className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700"
                  >
                    Autorizar / Reparar
                  </button>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">Cámara</p>
                  <p className="text-xs text-slate-400">{messages.camera}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {statusBadge(sensors.camera)}
                  <button
                    type="button"
                    onClick={authorizeCamera}
                    className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700"
                  >
                    Autorizar / Reparar
                  </button>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">Micrófono</p>
                  <p className="text-xs text-slate-400">{messages.microphone}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {statusBadge(sensors.microphone)}
                  <button
                    type="button"
                    onClick={authorizeMicrophone}
                    className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700"
                  >
                    Autorizar / Reparar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

