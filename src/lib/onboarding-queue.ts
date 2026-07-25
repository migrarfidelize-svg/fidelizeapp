import { useEffect, useState } from "react";

/**
 * Fila única de convites de entrada no app.
 * Garante que nunca aparecem dois modais empilhados: prioridade
 * instalar → notificações → tour. Quem está na frente segura a vez até
 * ser dispensado.
 */
export type OnboardingSlot = "install" | "push" | "tour";

const ORDER: OnboardingSlot[] = ["install", "push", "tour"];
/** Espera curta para todos os candidatos se registrarem antes da eleição. */
const SETTLE_MS = 700;

const wanted = new Set<OnboardingSlot>();
const listeners = new Set<() => void>();
let active: OnboardingSlot | null = null;
let electTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const l of listeners) l();
}

function elect() {
  const next = ORDER.find((s) => wanted.has(s)) ?? null;
  if (next !== active) {
    active = next;
    emit();
  }
}

function schedule() {
  if (electTimer) return;
  electTimer = setTimeout(() => {
    electTimer = null;
    elect();
  }, SETTLE_MS);
}

function request(slot: OnboardingSlot) {
  if (wanted.has(slot)) return;
  wanted.add(slot);
  if (active && ORDER.indexOf(active) <= ORDER.indexOf(slot)) return;
  schedule();
}

function release(slot: OnboardingSlot) {
  if (!wanted.has(slot) && active !== slot) return;
  wanted.delete(slot);
  if (active === slot) {
    active = null;
    elect();
  }
  emit();
}

/**
 * @param slot identificador do convite
 * @param wants true quando o componente tem algo a mostrar
 * @returns true somente quando é a vez desse convite
 */
export function useOnboardingSlot(slot: OnboardingSlot, wants: boolean): boolean {
  const [current, setCurrent] = useState<OnboardingSlot | null>(active);

  useEffect(() => {
    const l = () => setCurrent(active);
    listeners.add(l);
    l();
    return () => { listeners.delete(l); };
  }, []);

  useEffect(() => {
    if (wants) request(slot);
    else release(slot);
  }, [slot, wants]);

  useEffect(() => () => release(slot), [slot]);

  return current === slot;
}
