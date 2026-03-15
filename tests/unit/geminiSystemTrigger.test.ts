import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  responseEmit: vi.fn(),
  updateConversation: vi.fn(),
  addMessage: vi.fn(),
  addOrUpdateMessage: vi.fn(),
  setProcessing: vi.fn(),
  emitAgentMessage: vi.fn(),
  electronPowerStart: vi.fn(() => 1),
  electronPowerStop: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getName: () => 'AionUi',
    getVersion: () => '1.0.0-test',
  },
  powerSaveBlocker: {
    start: mocks.electronPowerStart,
    stop: mocks.electronPowerStop,
  },
}));

vi.mock('@office-ai/platform', () => ({
  bridge: {
    buildProvider: vi.fn(() => ({})),
    buildEmitter: vi.fn(() => ({
      emit: vi.fn(),
      on: vi.fn(),
    })),
  },
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    buildStorage: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    })),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  theme: {},
}));

vi.mock('@/channels/agent/ChannelEventBus', () => ({
  channelEventBus: {
    emitAgentMessage: mocks.emitAgentMessage,
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    geminiConversation: {
      responseStream: {
        emit: mocks.responseEmit,
      },
    },
  },
}));

vi.mock('@/process/initStorage', () => ({
  ProcessConfig: {
    get: vi.fn(),
    set: vi.fn(),
  },
  getSkillsDir: vi.fn(() => ''),
}));

vi.mock('@/extensions', () => ({
  ExtensionRegistry: {
    getInstance: () => ({
      getMcpServers: () => [],
    }),
  },
}));

vi.mock('@/common/utils/platformAuthType', () => ({
  getProviderAuthType: vi.fn(() => 'unknown'),
}));

vi.mock('@office-ai/aioncli-core', () => ({
  AuthType: {
    LOGIN_WITH_GOOGLE: 'LOGIN_WITH_GOOGLE',
    USE_VERTEX_AI: 'USE_VERTEX_AI',
  },
  getOauthInfoWithCache: vi.fn(),
  Storage: {
    getOAuthCredsPath: vi.fn(() => ''),
  },
}));

vi.mock('@process/database', () => ({
  getDatabase: () => ({
    updateConversation: mocks.updateConversation,
  }),
}));

vi.mock('@process/message', () => ({
  addMessage: mocks.addMessage,
  addOrUpdateMessage: mocks.addOrUpdateMessage,
  nextTickToLocalFinish: (callback: () => void) => callback(),
}));

vi.mock('@process/services/cron/CronBusyGuard', () => ({
  cronBusyGuard: {
    setProcessing: mocks.setProcessing,
  },
}));

import BaseAgentManager from '../../src/process/task/BaseAgentManager';
import { GeminiAgentManager } from '../../src/process/task/GeminiAgentManager';

describe('GeminiAgentManager system-trigger handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(BaseAgentManager.prototype, 'sendMessage').mockResolvedValue(undefined as any);
  });

  it('keeps user-initiated messages persisted locally', async () => {
    const manager = Object.create(GeminiAgentManager.prototype) as GeminiAgentManager & {
      refreshWorkerIfMcpChanged: ReturnType<typeof vi.fn>;
      bootstrap: Promise<void>;
      emit: ReturnType<typeof vi.fn>;
    };

    manager.conversation_id = 'conv_1';
    manager.bootstrap = Promise.resolve();
    manager.status = 'pending';
    manager.refreshWorkerIfMcpChanged = vi.fn();
    manager.emit = vi.fn();

    await manager.sendMessage({
      input: 'normal user message',
      msg_id: 'msg_user',
    } as any);

    expect(mocks.addMessage).toHaveBeenCalledOnce();
    expect(mocks.responseEmit).not.toHaveBeenCalled();
  });

  it('does not create a right-side user bubble for system-triggered cron sends', async () => {
    const manager = Object.create(GeminiAgentManager.prototype) as GeminiAgentManager & {
      refreshWorkerIfMcpChanged: ReturnType<typeof vi.fn>;
      bootstrap: Promise<void>;
      emit: ReturnType<typeof vi.fn>;
    };

    manager.conversation_id = 'conv_1';
    manager.bootstrap = Promise.resolve();
    manager.status = 'pending';
    manager.refreshWorkerIfMcpChanged = vi.fn();
    manager.emit = vi.fn();

    await manager.sendMessage({
      input: 'cron triggered message',
      msg_id: 'msg_cron',
      cronMeta: {
        source: 'cron',
        cronJobId: 'cron_job_1',
        cronJobName: 'Morning summary',
        triggeredAt: Date.now(),
      },
      systemTrigger: true,
    } as any);

    expect(mocks.addMessage).not.toHaveBeenCalled();
    expect(mocks.responseEmit).not.toHaveBeenCalled();
  });
});
