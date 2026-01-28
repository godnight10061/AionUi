/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from '@jest/globals';
import type { TMessage } from '../../src/common/chatLib';
import { composeMessage } from '../../src/common/chatLib';

describe('composeMessage tool_group immutability', () => {
  it('should not mutate the existing list and should return new references for tool_group updates', () => {
    const conversation_id = 'conv-1';
    const callId = 'call-1';

    const userMessage: TMessage = {
      id: 'msg-user-1',
      msg_id: 'msg-user-1',
      conversation_id,
      type: 'text',
      position: 'right',
      content: { content: '帮我整理我的文件夹' },
    };

    const toolGroupExecuting: TMessage = {
      id: 'msg-tool-1',
      msg_id: 'msg-tool-1',
      conversation_id,
      type: 'tool_group',
      content: [
        {
          callId,
          name: 'ReadFolder',
          description: 'List files in current directory',
          renderOutputAsMarkdown: false,
          status: 'Executing',
        },
      ],
    };

    const initialList: TMessage[] = [userMessage];
    const listAfterExecuting = composeMessage(toolGroupExecuting, initialList);

    // Expected behavior: do not mutate the existing list in-place (React state relies on immutability)
    expect(initialList).toHaveLength(1);
    expect(listAfterExecuting).not.toBe(initialList);
    expect(listAfterExecuting).toHaveLength(2);

    const toolMessageExecuting = listAfterExecuting.find((m) => m.type === 'tool_group');
    expect(toolMessageExecuting).toBeDefined();
    expect(toolMessageExecuting?.type).toBe('tool_group');
    expect((toolMessageExecuting as any).content[0].status).toBe('Executing');

    const toolGroupConfirming: TMessage = {
      id: 'msg-tool-2',
      msg_id: 'msg-tool-1',
      conversation_id,
      type: 'tool_group',
      content: [
        {
          callId,
          name: 'ReadFolder',
          description: 'List files in current directory',
          renderOutputAsMarkdown: false,
          status: 'Confirming',
          confirmationDetails: {
            type: 'info',
            title: 'Read folder',
            urls: [],
            prompt: 'Allow ReadFolder to read the selected folder?',
          },
        },
      ],
    };

    const listAfterConfirming = composeMessage(toolGroupConfirming, listAfterExecuting);
    expect(listAfterConfirming).not.toBe(listAfterExecuting);

    const toolMessageConfirming = listAfterConfirming.find((m) => m.type === 'tool_group') as any;
    expect(toolMessageConfirming?.content[0].status).toBe('Confirming');
    expect(toolMessageConfirming?.content[0].confirmationDetails).toBeDefined();
    expect(toolMessageConfirming?.content[0].confirmationDetails.type).toBe('info');
  });
});

