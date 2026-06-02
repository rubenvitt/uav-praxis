import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

beforeEach(() => localStorage.clear());

describe('useLocalStorage', () => {
  it('liefert den Default, wenn nichts gespeichert ist', () => {
    const { result } = renderHook(() => useLocalStorage('k', { n: 1 }));
    expect(result.current[0]).toEqual({ n: 1 });
  });

  it('persistiert Updates und liest sie zurück', () => {
    const { result, unmount } = renderHook(() => useLocalStorage('k', { n: 1 }));
    act(() => result.current[1]({ n: 2 }));
    expect(result.current[0]).toEqual({ n: 2 });
    unmount();
    const { result: zweiter } = renderHook(() => useLocalStorage('k', { n: 1 }));
    expect(zweiter.current[0]).toEqual({ n: 2 });
  });

  it('fällt bei kaputtem JSON auf den Default zurück', () => {
    localStorage.setItem('k', '{kaputt');
    const { result } = renderHook(() => useLocalStorage('k', { n: 9 }));
    expect(result.current[0]).toEqual({ n: 9 });
  });
});
