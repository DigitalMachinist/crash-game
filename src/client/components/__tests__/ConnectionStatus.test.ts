import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { connectionStatus, latency } from '../../lib/stores';
import ConnectionStatus from '../ConnectionStatus.svelte';

beforeEach(() => {
  connectionStatus.set('connected');
  latency.set(null);
});

describe('ConnectionStatus component', () => {
  describe('renders without crashing', () => {
    it('renders when status is connected', () => {
      connectionStatus.set('connected');
      const { container } = render(ConnectionStatus);
      expect(container).toBeTruthy();
    });

    it('renders when status is reconnecting', () => {
      connectionStatus.set('reconnecting');
      const { container } = render(ConnectionStatus);
      expect(container).toBeTruthy();
    });

    it('renders when status is disconnected', () => {
      connectionStatus.set('disconnected');
      const { container } = render(ConnectionStatus);
      expect(container).toBeTruthy();
    });
  });

  describe('connected state', () => {
    it('shows dash when status is connected and latency is null', () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);
      expect(screen.getByText('—')).toBeTruthy();
    });

    it('does not show RECONNECTING when status is connected', () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);
      expect(screen.queryByText('RECONNECTING')).toBeNull();
    });

    it('does not show OFFLINE when status is connected', () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);
      expect(screen.queryByText('OFFLINE')).toBeNull();
    });

    it('dot has "connected" class when status is connected', () => {
      connectionStatus.set('connected');
      const { container } = render(ConnectionStatus);
      const dot = container.querySelector('.dot');
      expect(dot?.classList.contains('connected')).toBe(true);
    });
  });

  describe('reconnecting state', () => {
    it('shows "RECONNECTING" label when status is reconnecting', () => {
      connectionStatus.set('reconnecting');
      render(ConnectionStatus);
      expect(screen.getByText('RECONNECTING')).toBeTruthy();
    });

    it('does not show "—" when status is reconnecting', () => {
      connectionStatus.set('reconnecting');
      render(ConnectionStatus);
      expect(screen.queryByText('—')).toBeNull();
    });

    it('does not show OFFLINE when status is reconnecting', () => {
      connectionStatus.set('reconnecting');
      render(ConnectionStatus);
      expect(screen.queryByText('OFFLINE')).toBeNull();
    });

    it('dot has "reconnecting" class when status is reconnecting', () => {
      connectionStatus.set('reconnecting');
      const { container } = render(ConnectionStatus);
      const dot = container.querySelector('.dot');
      expect(dot?.classList.contains('reconnecting')).toBe(true);
    });
  });

  describe('disconnected state', () => {
    it('shows "OFFLINE" label when status is disconnected', () => {
      connectionStatus.set('disconnected');
      render(ConnectionStatus);
      expect(screen.getByText('OFFLINE')).toBeTruthy();
    });

    it('does not show "—" when status is disconnected', () => {
      connectionStatus.set('disconnected');
      render(ConnectionStatus);
      expect(screen.queryByText('—')).toBeNull();
    });

    it('does not show RECONNECTING when status is disconnected', () => {
      connectionStatus.set('disconnected');
      render(ConnectionStatus);
      expect(screen.queryByText('RECONNECTING')).toBeNull();
    });

    it('dot has "offline" class when status is disconnected', () => {
      connectionStatus.set('disconnected');
      const { container } = render(ConnectionStatus);
      const dot = container.querySelector('.dot');
      expect(dot?.classList.contains('offline')).toBe(true);
    });
  });

  describe('latency display', () => {
    it('shows "—" when latency is null', () => {
      connectionStatus.set('connected');
      latency.set(null);
      render(ConnectionStatus);
      expect(screen.queryByText(/ms$/)).toBeNull();
      expect(screen.getByText('—')).toBeTruthy();
    });

    it('shows latency when connected and latency is set', async () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);
      latency.set(42);
      await tick();
      expect(screen.getByText('42ms')).toBeTruthy();
    });

    it('does not show latency when disconnected even if latency is set', async () => {
      connectionStatus.set('disconnected');
      render(ConnectionStatus);
      latency.set(42);
      await tick();
      expect(screen.queryByText('42ms')).toBeNull();
    });

    it('latency element uses "latency" class when connected', async () => {
      connectionStatus.set('connected');
      const { container } = render(ConnectionStatus);
      latency.set(42);
      await tick();
      const latencyEl = container.querySelector('.latency');
      expect(latencyEl).toBeTruthy();
      expect(latencyEl?.textContent).toBe('42ms');
    });

    it('latency element is always shown when connected (no color variation by ms value)', async () => {
      connectionStatus.set('connected');
      const { container } = render(ConnectionStatus);
      latency.set(300);
      await tick();
      const latencyEl = container.querySelector('.latency');
      expect(latencyEl).toBeTruthy();
      expect(latencyEl?.textContent).toBe('300ms');
    });
  });

  describe('reactive updates', () => {
    it('updates from dash to RECONNECTING when status changes from connected to reconnecting', async () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);
      expect(screen.getByText('—')).toBeTruthy();

      connectionStatus.set('reconnecting');
      await tick();

      expect(screen.queryByText('—')).toBeNull();
      expect(screen.getByText('RECONNECTING')).toBeTruthy();
    });

    it('updates from RECONNECTING to dash when status changes from reconnecting to connected', async () => {
      connectionStatus.set('reconnecting');
      render(ConnectionStatus);
      expect(screen.getByText('RECONNECTING')).toBeTruthy();

      connectionStatus.set('connected');
      await tick();

      expect(screen.queryByText('RECONNECTING')).toBeNull();
      expect(screen.getByText('—')).toBeTruthy();
    });

    it('updates to OFFLINE when status changes to disconnected', async () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);

      connectionStatus.set('disconnected');
      await tick();

      expect(screen.queryByText('—')).toBeNull();
      expect(screen.getByText('OFFLINE')).toBeTruthy();
    });
  });
});
