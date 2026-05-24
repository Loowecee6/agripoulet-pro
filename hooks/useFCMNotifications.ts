// hooks/useFCMNotifications.ts
// Gestion des notifications FCM et vérifications périodiques
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppData } from '../types';
import {
  checkAllNotifications,
  type NotificationEvent,
} from '../services/notificationChecks';
import {
  showLocalNotificationsFor,
  requestNotificationPermission,
  initFCM,
  getFCMToken,
  resetShownNotifications,
} from '../services/notificationService';

interface UseFCMNotificationsOptions {
  user: { uid: string } | null;
  data: AppData | null;
  isInitialLoading: boolean;
  setData: React.Dispatch<React.SetStateAction<AppData | null>>;
}

interface FCMNotificationsResult {
  notificationEvents: NotificationEvent[];
  notifications: AppData['sales'];
  overdueCount: number;
}

export function useFCMNotifications({
  user,
  data,
  isInitialLoading,
  setData,
}: UseFCMNotificationsOptions): FCMNotificationsResult {
  const [notificationEvents, setNotificationEvents] = useState<NotificationEvent[]>([]);
  const fcmInitedRef = useRef(false);

  // Notifications de crédit (échéances à venir)
  const notifications = useMemo(() => {
    if (!data) return [];
    const today = new Date();
    return data.sales.filter(
      (s) =>
        s.isCredit &&
        !s.isPaid &&
        s.dueDate &&
        new Date(s.dueDate) <= new Date(today.getTime() + 7 * 86400000)
    );
  }, [data]);

  const overdueCount = useMemo(() => {
    if (!data) return 0;
    const today = new Date();
    return data.sales.filter(
      (s) => s.isCredit && !s.isPaid && s.dueDate && new Date(s.dueDate) < today
    ).length;
  }, [data]);

  // Periodic notification checker
  useEffect(() => {
    if (!data || isInitialLoading) return;

    const check = () => {
      const events = checkAllNotifications(data);
      setNotificationEvents(events);
      showLocalNotificationsFor(events, data);
    };

    check();
    const interval = setInterval(check, 60000);

    return () => clearInterval(interval);
  }, [data, isInitialLoading]);

  // Dark mode effect
  useEffect(() => {
    if (data?.settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [data?.settings.darkMode]);

  // FCM initialization on login
  useEffect(() => {
    if (!user || fcmInitedRef.current) return;
    fcmInitedRef.current = true;

    const init = async () => {
      const granted = await requestNotificationPermission();
      if (!granted) return;

      await initFCM();

      const token = await getFCMToken();
      if (token) {
        setData((prev) => {
          if (!prev || prev.fcmToken === token) return prev;
          return { ...prev, fcmToken: token };
        });
      }
    };
    init();

    return () => {
      resetShownNotifications();
    };
  }, [user, setData]);

  return {
    notificationEvents,
    notifications,
    overdueCount,
  };
}
