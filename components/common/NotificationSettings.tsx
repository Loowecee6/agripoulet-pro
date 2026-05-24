// components/common/NotificationSettings.tsx
// Interface de paramètres des notifications push pour AgriPoulet Pro

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Syringe, AlertTriangle, CreditCard, Vibrate, Info, ShieldCheck, ExternalLink } from 'lucide-react';
import { NotificationPrefs } from '../../types';
import { Modal } from './Modal';
import { hasNotificationPermission, requestNotificationPermission } from '../../services/notificationService';

interface NotificationSettingsProps {
  prefs: NotificationPrefs;
  onSave: (prefs: NotificationPrefs) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettings = ({ prefs, onSave, isOpen, onClose }: NotificationSettingsProps) => {
  const [local, setLocal] = useState<NotificationPrefs>(prefs);
  const [permGranted, setPermGranted] = useState(false);

  useEffect(() => {
    setLocal(prefs);
    setPermGranted(hasNotificationPermission());
  }, [prefs]);

  const toggle = (key: keyof NotificationPrefs) => {
    setLocal(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermGranted(granted);
    if (granted) {
      // Activer les notifications si permission accordée
      setLocal(prev => ({ ...prev, enabled: true }));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔔 Notifications">
      <div className="space-y-5">
        {/* Permission status */}
        <div className={`rounded-2xl p-4 flex items-start gap-3 ${
          permGranted
            ? 'bg-green-50 border border-green-100'
            : 'bg-yellow-50 border border-yellow-100'
        }`}>
          {permGranted ? (
            <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <Bell className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="text-sm font-bold text-gray-800">
              {permGranted ? 'Notifications activées ✓' : "Permission requise"}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              {permGranted
                ? 'Vous recevrez des alertes même lorsque l\'app est fermée.'
                : 'Autorisez les notifications pour être alerté des échéances et rappels.'}
            </p>
            {!permGranted && (
              <button
                onClick={handleRequestPermission}
                className="mt-2 bg-yellow-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-wider active:scale-95 transition-transform"
              >
                Activer les notifications
              </button>
            )}
          </div>
        </div>

        {/* Master toggle */}
        <div className={`flex items-center justify-between p-4 rounded-2xl border ${
          local.enabled ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            {local.enabled ? (
              <Bell className="w-5 h-5 text-orange-600" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <div className="text-sm font-bold text-gray-800">Notifications activées</div>
              <div className="text-[9px] text-gray-400">
                {local.enabled ? 'Alertes actives pour tous les événements cochés' : 'Toutes les alertes sont désactivées'}
              </div>
            </div>
          </div>
          <button
            onClick={() => toggle('enabled')}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              local.enabled ? 'bg-orange-600' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
              local.enabled ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {/* Sub-toggles */}
        <div className="space-y-2">
          <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider ml-1 mb-3">
            Types d'alertes
          </div>

          <NotificationToggle
            icon={<Syringe className="w-5 h-5 text-blue-600" />}
            label="Rappels Vaccination"
            desc="Anti Stress, Gumboro, Newcastle — 2 jours avant"
            enabled={local.enabled && local.vaccinationReminders}
            disabled={!local.enabled}
            onToggle={() => local.enabled && toggle('vaccinationReminders')}
          />

          <NotificationToggle
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            label="Alertes Mortalité"
            desc="Mortalité anormale (>3%) détectée"
            enabled={local.enabled && local.mortalityAlerts}
            disabled={!local.enabled}
            onToggle={() => local.enabled && toggle('mortalityAlerts')}
          />

          <NotificationToggle
            icon={<CreditCard className="w-5 h-5 text-orange-600" />}
            label="Échéances Crédit"
            desc="Crédit en retard ou échéance dans 3 jours"
            enabled={local.enabled && local.creditDeadlines}
            disabled={!local.enabled}
            onToggle={() => local.enabled && toggle('creditDeadlines')}
          />
        </div>

        {/* Info note */}
        {!permGranted && (
          <div className="bg-blue-50 rounded-2xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-[9px] text-blue-700">
              <strong>Configuration push :</strong> Pour recevoir des notifications même après avoir fermé l'application,
              générez une clé VAPID dans la console Firebase (Project Settings &gt; Cloud Messaging)
              et ajoutez-la à votre fichier <code>.env.local</code>.
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-600 p-4 rounded-2xl font-bold text-xs uppercase active:scale-95 transition-transform"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-orange-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Sub-component for individual toggle rows
const NotificationToggle = ({
  icon,
  label,
  desc,
  enabled,
  disabled,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) => (
  <div
    className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${
      enabled ? 'bg-white border-gray-200' : disabled ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-white border-gray-200'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xs font-bold text-gray-800">{label}</div>
        <div className="text-[8px] text-gray-400">{desc}</div>
      </div>
    </div>
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`w-10 h-5 rounded-full transition-colors relative ${
        enabled ? 'bg-orange-600' : 'bg-gray-300'
      }`}
    >
      <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
        enabled ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  </div>
);
