import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cronUpdatedEmit: vi.fn(),
  conversationResponseEmit: vi.fn(),
  updateConversation: vi.fn(),
  addMessage: vi.fn(),
  powerStart: vi.fn(() => 1),
  powerStop: vi.fn(),
  getTaskById: vi.fn(),
  getTaskByIdRollbackBuild: vi.fn(),
  kill: vi.fn(),
  copyFilesToDirectory: vi.fn(async () => []),
}));

vi.mock('electron', () => ({
  powerSaveBlocker: {
    start: mocks.powerStart,
    stop: mocks.powerStop,
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    cron: {
      onJobUpdated: {
        emit: mocks.cronUpdatedEmit,
      },
    },
    conversation: {
      responseStream: {
        emit: mocks.conversationResponseEmit,
      },
    },
  },
}));

vi.mock('@process/database', () => ({
  getDatabase: () => ({
    updateConversation: mocks.updateConversation,
  }),
}));

vi.mock('@process/message', () => ({
  addMessage: mocks.addMessage,
}));

vi.mock('../../src/process/WorkerManage', () => ({
  default: {
    getTaskById: mocks.getTaskById,
    getTaskByIdRollbackBuild: mocks.getTaskByIdRollbackBuild,
    kill: mocks.kill,
  },
}));

vi.mock('../../src/process/utils', () => ({
  copyFilesToDirectory: mocks.copyFilesToDirectory,
}));

import { cronBusyGuard } from '../../src/process/services/cron/CronBusyGuard';
import { cronStore, type CronJob } from '../../src/process/services/cron/CronStore';
import { cronService } from '../../src/process/services/cron/CronService';

function createJob(agentType: CronJob['metadata']['agentType']): CronJob {
  return {
    id: 'cron_job_1',
    name: 'Morning summary',
    enabled: true,
    schedule: {
      kind: 'every',
      everyMs: 60_000,
      description: 'Every minute',
    },
    target: {
      payload: {
        kind: 'message',
        text: 'Summarize the current task list.',
      },
    },
    metadata: {
      conversationId: 'conv_1',
      conversationTitle: 'Daily assistant',
      agentType,
      createdBy: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    state: {
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
    },
  };
}

describe('CronService system-trigger dispatch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    vi.spyOn(cronBusyGuard, 'isProcessing').mockReturnValue(false);
    vi.spyOn(cronStore, 'update').mockImplementation(() => undefined);
  });

  it('does not pass msg_id when dispatching ACP-backed cron messages', async () => {
    const job = createJob('claude');
    const task = {
      type: 'acp',
      workspace: 'D:\\godnight1\\contributions\\AionUi',
      ensureYoloMode: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    mocks.getTaskById.mockReturnValue(task as any);
    mocks.getTaskByIdRollbackBuild.mockResolvedValue(task as any);
    mocks.kill.mockImplementation(() => undefined);
    vi.spyOn(cronStore, 'getById').mockImplementation(() => job);

    await (cronService as any).executeJob(job);

    expect(task.sendMessage).toHaveBeenCalledOnce();
    const payload = task.sendMessage.mock.calls[0][0];
    expect(payload).toMatchObject({
      content: 'Summarize the current task list.',
      files: [],
      cronMeta: expect.objectContaining({
        source: 'cron',
        cronJobId: job.id,
        cronJobName: job.name,
      }),
    });
    expect(payload).not.toHaveProperty('msg_id');
  });

  it('marks Gemini cron dispatches as system-triggered', async () => {
    const job = createJob('gemini');
    const task = {
      type: 'gemini',
      workspace: 'D:\\godnight1\\contributions\\AionUi',
      ensureYoloMode: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    mocks.getTaskById.mockReturnValue(task as any);
    mocks.getTaskByIdRollbackBuild.mockResolvedValue(task as any);
    mocks.kill.mockImplementation(() => undefined);
    vi.spyOn(cronStore, 'getById').mockImplementation(() => job);

    await (cronService as any).executeJob(job);

    expect(task.sendMessage).toHaveBeenCalledOnce();
    expect(task.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'Summarize the current task list.',
        files: [],
        msg_id: expect.any(String),
        systemTrigger: true,
        cronMeta: expect.objectContaining({
          source: 'cron',
          cronJobId: job.id,
          cronJobName: job.name,
        }),
      })
    );
  });
});
