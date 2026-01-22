/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, jest } from '@jest/globals';
import { AcpConnection } from '../../src/agent/acp/AcpConnection';
import { AcpAgent } from '../../src/agent/acp';

describe('Claude YOLO mode', () => {
  it('sets ACP session mode to bypassPermissions when enabled', async () => {
    jest.spyOn(AcpConnection.prototype, 'connect').mockResolvedValue(undefined);
    jest.spyOn(AcpConnection.prototype, 'getInitializeResponse').mockReturnValue(null);

    jest.spyOn(AcpConnection.prototype, 'newSession').mockImplementation(async function (this: unknown) {
      // Mimic AcpConnection.newSession side-effect for hasActiveSession checks
      (this as { sessionId: string | null }).sessionId = 'session-1';
      return { jsonrpc: '2.0', id: 0, sessionId: 'session-1' } as any;
    });

    const sendRequestSpy = jest.spyOn(AcpConnection.prototype as any, 'sendRequest').mockResolvedValue({});

    const agent = new AcpAgent({
      id: 'conv-1',
      backend: 'claude',
      workingDir: process.cwd(),
      onStreamEvent: () => {},
      extra: {
        backend: 'claude',
        workspace: process.cwd(),
        yoloMode: true,
      } as any,
    });

    await agent.start();

    expect(sendRequestSpy).toHaveBeenCalledWith('session/set_mode', {
      sessionId: 'session-1',
      modeId: 'bypassPermissions',
    });
  });
});
