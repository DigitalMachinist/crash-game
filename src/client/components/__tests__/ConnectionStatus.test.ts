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
    it('shows "Connected" label when status is connected', () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);
      expect(screen.getByText('Connected')).toBeTruthy();
    });

    it('does not show "Reconnecting" when status is connected', () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);
      expect(screen.queryByText('Reconnecting')).toBeNull();
    });

    it('does not show "Disconnected" when status is connected', () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);
      expect(screen.queryByText('Disconnected')).toBeNull();
    });

    it('renders dot element with green color when connected', () => {
      connectionStatus.set('connected');
      const { container } = render(ConnectionStatus);
      const dot = container.querySelector('.dot');
      expect(dot).toBeTruthy();
      const style = (dot as HTMLElement).getAttribute('style') ?? '';
      // jsdom normalizes hex colors to rgb — #00c853 = rgb(0, 200, 83)
      expect(style).toContain('rgb(0, 200, 83)');
    });
  });

  describe('reconnecting state', () => {
    it('shows "Reconnecting" label when status is reconnecting', () => {
      connectionStatus.set('reconnecting');
      render(ConnectionStatus);
      expect(screen.getByText('Reconnecting')).toBeTruthy();
    });

    it('does not show "Connected" when status is reconnecting', () => {
      connectionStatus.set('reconnecting');
      render(ConnectionStatus);
      expect(screen.queryByText('Connected')).toBeNull();
    });

    it('does not show "Disconnected" when status is reconnecting', () => {
      connectionStatus.set('reconnecting');
      render(ConnectionStatus);
      expect(screen.queryByText('Disconnected')).toBeNull();
    });

    it('renders dot element with yellow color when reconnecting', () => {
      connectionStatus.set('reconnecting');
      const { container } = render(ConnectionStatus);
      const dot = container.querySelector('.dot');
      expect(dot).toBeTruthy();
      const style = (dot as HTMLElement).getAttribute('style') ?? '';
      expect(style).toContain('gold');
    });
  });

  describe('disconnected state', () => {
    it('shows "Disconnected" label when status is disconnected', () => {
      connectionStatus.set('disconnected');
      render(ConnectionStatus);
      expect(screen.getByText('Disconnected')).toBeTruthy();
    });

    it('does not show "Connected" when status is disconnected', () => {
      connectionStatus.set('disconnected');
      render(ConnectionStatus);
      expect(screen.queryByText('Connected')).toBeNull();
    });

    it('does not show "Reconnecting" when status is disconnected', () => {
      connectionStatus.set('disconnected');
      render(ConnectionStatus);
      expect(screen.queryByText('Reconnecting')).toBeNull();
    });

    it('renders dot element with red color when disconnected', () => {
      connectionStatus.set('disconnected');
      const { container } = render(ConnectionStatus);
      const dot = container.querySelector('.dot');
      expect(dot).toBeTruthy();
      const style = (dot as HTMLElement).getAttribute('style') ?? '';
      expect(style).toContain('crimson');
    });
  });

  describe('latency display', () => {
    it('does not show latency when latency is null', () => {
      connectionStatus.set('connected');
      latency.set(null);
      render(ConnectionStatus);
      expect(screen.queryByText(/ms$/)).toBeNull();
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

    it('renders latency in green for low latency (< 100ms)', async () => {
      connectionStatus.set('connected');
      const { container } = render(ConnectionStatus);
      latency.set(42);
      await tick();
      const latencyEl = container.querySelector('.latency');
      expect(latencyEl).toBeTruthy();
      const style = (latencyEl as HTMLElement).getAttribute('style') ?? '';
      // jsdom normalizes #00c853 to rgb(0, 200, 83)
      expect(style).toContain('rgb(0, 200, 83)');
    });

    it('renders latency in gold for medium latency (100-249ms)', async () => {
      connectionStatus.set('connected');
      const { container } = render(ConnectionStatus);
      latency.set(150);
      await tick();
      const latencyEl = container.querySelector('.latency');
      expect(latencyEl).toBeTruthy();
      const style = (latencyEl as HTMLElement).getAttribute('style') ?? '';
      expect(style).toContain('gold');
    });

    it('renders latency in crimson for high latency (>= 250ms)', async () => {
      connectionStatus.set('connected');
      const { container } = render(ConnectionStatus);
      latency.set(300);
      await tick();
      const latencyEl = container.querySelector('.latency');
      expect(latencyEl).toBeTruthy();
      const style = (latencyEl as HTMLElement).getAttribute('style') ?? '';
      expect(style).toContain('crimson');
    });
  });

  describe('reactive updates', () => {
    it('updates label when status changes from connected to reconnecting', async () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);
      expect(screen.getByText('Connected')).toBeTruthy();

      connectionStatus.set('reconnecting');
      await tick();

      expect(screen.queryByText('Connected')).toBeNull();
      expect(screen.getByText('Reconnecting')).toBeTruthy();
    });

    it('updates label when status changes from reconnecting to connected', async () => {
      connectionStatus.set('reconnecting');
      render(ConnectionStatus);
      expect(screen.getByText('Reconnecting')).toBeTruthy();

      connectionStatus.set('connected');
      await tick();

      expect(screen.queryByText('Reconnecting')).toBeNull();
      expect(screen.getByText('Connected')).toBeTruthy();
    });

    it('updates label when status changes to disconnected', async () => {
      connectionStatus.set('connected');
      render(ConnectionStatus);

      connectionStatus.set('disconnected');
      await tick();

      expect(screen.queryByText('Connected')).toBeNull();
      expect(screen.getByText('Disconnected')).toBeTruthy();
    });
  });
});
