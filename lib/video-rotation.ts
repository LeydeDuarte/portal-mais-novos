'use client';

import { useEffect, useRef, useState } from 'react';

// Autoplay rotativo dos imóveis com vídeo de capa: nunca mais de MAX_PLAYING
// vídeos tocando ao mesmo tempo no feed inteiro. Entre os visíveis na tela,
// prioriza o maior matchScore (afinidade de perfil) e troca periodicamente o
// que está tocando há mais tempo pelo próximo melhor candidato visível.

const MAX_PLAYING = 3;
const ROTATE_MS = 5500;

type Entry = {
  id: string;
  matchScore: number;
  visible: boolean;
  playing: boolean;
  activatedAt: number;
};

type Listener = (playing: Set<string>) => void;

class VideoRotationManager {
  private pool = new Map<string, Entry>();
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  register(id: string, matchScore: number) {
    this.pool.set(id, { id, matchScore, visible: false, playing: false, activatedAt: 0 });
    this.ensureTimer();
  }

  unregister(id: string) {
    this.pool.delete(id);
  }

  setVisible(id: string, visible: boolean) {
    const entry = this.pool.get(id);
    if (!entry) return;
    entry.visible = visible;
    if (!visible && entry.playing) entry.playing = false;
    this.reevaluate();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.playingIds());
    return () => this.listeners.delete(listener);
  }

  private playingIds() {
    return new Set([...this.pool.values()].filter((e) => e.playing).map((e) => e.id));
  }

  private notify() {
    const ids = this.playingIds();
    this.listeners.forEach((l) => l(ids));
  }

  private reevaluate() {
    const playing = [...this.pool.values()].filter((e) => e.playing);
    const slotsOpen = MAX_PLAYING - playing.length;
    if (slotsOpen > 0) {
      const candidates = [...this.pool.values()]
        .filter((e) => e.visible && !e.playing)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, slotsOpen);
      candidates.forEach((e) => {
        e.playing = true;
        e.activatedAt = Date.now();
      });
    }
    this.notify();
  }

  private rotate() {
    const playing = [...this.pool.values()].filter((e) => e.playing);
    const waiting = [...this.pool.values()]
      .filter((e) => e.visible && !e.playing)
      .sort((a, b) => b.matchScore - a.matchScore);

    if (playing.length === 0 || waiting.length === 0) {
      this.reevaluate();
      return;
    }

    playing.sort((a, b) => a.activatedAt - b.activatedAt);
    playing[0].playing = false;
    waiting[0].playing = true;
    waiting[0].activatedAt = Date.now();
    this.notify();
  }

  private ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this.rotate(), ROTATE_MS);
  }
}

export const videoRotationManager = new VideoRotationManager();

/** Hook para um card de imóvel com vídeo de capa: informa visibilidade via
 * IntersectionObserver e devolve se este card está na vez de "tocar". */
export function useVideoAutoplay(id: string, matchScore: number, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    videoRotationManager.register(id, matchScore);
    const unsubscribe = videoRotationManager.subscribe((playingIds) => setIsPlaying(playingIds.has(id)));

    const node = ref.current;
    let observer: IntersectionObserver | null = null;
    if (node) {
      observer = new IntersectionObserver(
        (entries) => entries.forEach((entry) => videoRotationManager.setVisible(id, entry.isIntersecting)),
        { threshold: 0.5 }
      );
      observer.observe(node);
    }

    return () => {
      observer?.disconnect();
      unsubscribe();
      videoRotationManager.unregister(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled]);

  return { ref, isPlaying };
}
